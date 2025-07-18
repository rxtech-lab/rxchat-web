'use server';

import { auth } from '@/app/(auth)/auth';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { getModelProvider } from '@/lib/ai/providers';
import { CHUNK_SIZE } from '@/lib/constants';
import { getDocumentById } from '@/lib/db/queries';
import { db } from '@/lib/db/queries/client';
import {
  createVectorStoreDocument,
  deleteDocumentById,
  getDocumentBySha256,
  getDocumentsByIds,
  getDocumentsForUser,
  getVectorStoreDocumentById,
  updateDocumentVisibility,
  updateVectorStoreDocument,
} from '@/lib/db/queries/vector-store';
import type { VectorStoreDocument } from '@/lib/db/schema';
import { createMarkitdownClient } from '@/lib/document/markitdown';
import { createVectorStoreClient } from '@/lib/document/vector_store';
import { ChatSDKError } from '@/lib/errors';
import { createS3Client } from '@/lib/s3/index';
import { S3Client } from '@/lib/s3/s3';
import { calculateSha256FromUrl } from '@/lib/utils.server';
import { OnStepSchema, type OnStep } from '@/lib/workflow/types';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { track } from '@vercel/analytics/server';
import { generateText } from 'ai';
import path from 'node:path';
import { z } from 'zod';

// Types
export interface DocumentHistory {
  documents: Array<VectorStoreDocument>;
  hasMore: boolean;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  documentId: string;
  key: string;
}

// Schemas
const GetDocumentsSchema = z.object({
  limit: z.number().default(20),
  startingAfter: z.string().optional().nullable(),
  endingBefore: z.string().optional().nullable(),
});

const SearchDocumentsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().default(10),
});

const SearchDocumentsByIdSchema = z.object({
  documentId: z.string().uuid(),
  query: z.string().min(1),
  limit: z.number().default(10),
});

const CompleteDocumentUploadSchema = z.object({
  documentId: z.string().uuid(),
});

const DeleteDocumentSchema = z.object({
  id: z.string().uuid(),
});

const GetPresignedUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
});

const RenameDocumentSchema = z.object({
  id: z.string().uuid(),
  newName: z.string().min(1).max(255),
});

const UpdateVisibilitySchema = z.object({
  id: z.string().uuid(),
  visibility: z.enum(['public', 'private']),
});

export async function getPresignedUploadUrl(
  data: z.infer<typeof GetPresignedUploadUrlSchema>,
): Promise<{ url: string; id: string } | { error: string }> {
  const session = await auth();
  if (!session?.user) {
    return {
      error: 'Unauthorized: You must be logged in to upload documents.',
    };
  }

  const parsed = GetPresignedUploadUrlSchema.safeParse(data);
  if (!parsed.success) {
    return {
      error: 'Bad Request: Invalid file parameters.',
    };
  }
  const { fileName, fileSize, mimeType } = parsed.data;
  const s3Client = createS3Client();
  // Add missing properties: content, key, and status for document creation
  const id = crypto.randomUUID(); // Generate a unique ID for the document
  const fileExt = path.extname(fileName).toLowerCase();
  const fileKey = `documents/${id}${fileExt}`;

  const document = await createVectorStoreDocument({
    id,
    userId: session.user.id,
    originalFileName: fileName,
    mimeType,
    size: fileSize,
    content: '', // or null if allowed
    key: fileKey,
    status: 'pending',
    sha256: null,
    visibility: 'private',
  });

  const url = await s3Client.getPresignedUploadUrl(fileKey, mimeType);

  return {
    url: url.uploadUrl,
    id: document.id,
  };
}

/**
 * Server action to list documents with pagination
 */
export async function listDocuments({
  limit = 20,
  startingAfter,
  endingBefore,
}: {
  limit?: number;
  startingAfter?: string | null;
  endingBefore?: string | null;
}): Promise<DocumentHistory> {
  const session = await auth();

  if (!session?.user) {
    throw new ChatSDKError('unauthorized:document');
  }

  const parsed = GetDocumentsSchema.safeParse({
    limit,
    startingAfter,
    endingBefore,
  });

  if (!parsed.success) {
    throw new ChatSDKError('bad_request:api', 'Invalid pagination parameters');
  }

  try {
    const result = await getDocumentsForUser({
      userId: session.user.id,
      limit: parsed.data.limit,
      startingAfter: parsed.data.startingAfter || null,
      endingBefore: parsed.data.endingBefore || null,
    });

    return {
      documents: result.docs,
      hasMore: result.hasMore,
    };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError('bad_request:api', 'Failed to fetch documents');
  }
}

/**
 * Server action to search documents using vector search
 */
export async function searchDocuments({
  query,
  limit = 10,
  visibility = 'private',
}: {
  query: string;
  limit?: number;
  visibility?: 'public' | 'private';
}): Promise<VectorStoreDocument[]> {
  const session = await auth();

  if (!session?.user) {
    throw new ChatSDKError('unauthorized:document');
  }

  const parsed = SearchDocumentsSchema.safeParse({ query, limit });

  if (!parsed.success) {
    throw new ChatSDKError('bad_request:api', 'Invalid search parameters');
  }

  try {
    const vectorStore = createVectorStoreClient();
    const searchResults = await vectorStore.searchDocument(parsed.data.query, {
      userId: session.user.id,
      limit: parsed.data.limit,
      visibility,
    });

    let documents = await getDocumentsByIds({
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      ids: searchResults.map((doc) => doc.metadata.documentId!),
      dbConnection: db,
      status: 'completed',
      userId: session.user.id,
    });

    // join searchresults content by id and attach to the document
    // replace the document's content with the joined content
    documents = documents.map((doc) => ({
      ...doc,
      content: searchResults
        .filter((result) => result.id === doc.id)
        .map((result) => result.content)
        .join('\n\n'),
    }));

    return documents;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError('bad_request:api', 'Failed to search documents');
  }
}

/**
 * Server action to search documents by document ID and query using vector search
 */
export async function searchDocumentsById({
  documentId,
  query,
  limit = 10,
}: {
  documentId: string;
  query: string;
  limit?: number;
}): Promise<VectorStoreDocument[]> {
  const session = await auth();

  if (!session?.user) {
    throw new ChatSDKError('unauthorized:document');
  }

  const parsed = SearchDocumentsByIdSchema.safeParse({
    documentId,
    query,
    limit,
  });

  if (!parsed.success) {
    throw new ChatSDKError('bad_request:api', 'Invalid search parameters');
  }

  try {
    const vectorStore = createVectorStoreClient();
    const searchResults = await vectorStore.searchDocumentById(
      parsed.data.documentId,
      parsed.data.query,
      {
        userId: session.user.id,
        limit: parsed.data.limit,
      },
    );

    let documents = await getDocumentsByIds({
      ids: [parsed.data.documentId],
      dbConnection: db,
      userId: session.user.id,
      status: 'completed',
    });

    // join searchresults content by id and attach to the document
    // replace the document's content with the joined content
    documents = documents.map((doc) => ({
      ...doc,
      content: searchResults
        .filter((result) => result.id === doc.id)
        .map((result) => result.content)
        .join('\n\n'),
    }));

    return documents;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:api',
      'Failed to search documents by ID',
    );
  }
}

async function chunkContent(content: string, chunkSize: number) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap: 0,
  });
  const chunks = await splitter.splitText(content);
  return chunks;
}

/**
 * Generate an AI summary from the first chunk of document content
 */
async function generateDocumentSummary(firstChunk: string): Promise<string> {
  try {
    // Use openRouter as default provider since it's commonly available
    const provider = getModelProvider(DEFAULT_CHAT_MODEL, 'openRouter');

    const { text: summary } = await generateText({
      model: provider.languageModel('title-model'),
      system: `
    - you will generate a concise summary of the provided document content
    - the summary should capture the main points and topics of the document
    - focus on the key information and purpose of the document
    - do not use quotes or colons.`,
      prompt: firstChunk,
    });

    return summary;
  } catch (error) {
    console.error('Failed to generate document summary:', error);
    // Fallback to truncated content if AI generation fails
    return firstChunk.slice(0, 200);
  }
}

/**
 * Server action to complete document upload - Step 2 of two-step upload
 * Updates document with content and adds to vector store
 */
export async function completeDocumentUpload({
  documentId,
}: {
  documentId: string;
}): Promise<{ error?: string }> {
  const session = await auth();

  if (!session?.user) {
    return {
      error:
        'Unauthorized: You must be logged in to complete document uploads.',
    };
  }

  const parsed = CompleteDocumentUploadSchema.safeParse({
    documentId,
  });

  if (!parsed.success) {
    return {
      error: 'Bad Request: Invalid document upload parameters.',
    };
  }

  const markitdownClient = createMarkitdownClient();
  const s3Client = createS3Client();

  try {
    await db.transaction(async (tx) => {
      // Step 1: Verify document exists and belongs to user
      const documents = await getDocumentsByIds({
        ids: [parsed.data.documentId],
        userId: session.user.id,
        dbConnection: tx,
      });

      if (documents.length === 0) {
        return {
          error: 'Not Found: Document not found or does not exist.',
        };
      }

      const document = documents[0];

      if (document.userId !== session.user.id) {
        return {
          error:
            'Forbidden: You do not have permission to complete this document upload.',
        };
      }

      // Step 2: Download file and calculate SHA256 hash
      const downloadUrl = await s3Client.getFileUrl(
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        document.key!,
        { ttl: 3600 }, // 1 hour TTL for download URL
      );

      // Calculate SHA256 hash for duplicate detection
      const sha256Hash = await calculateSha256FromUrl(downloadUrl);

      // Check if document with same SHA256 already exists
      const existingDocument = await getDocumentBySha256({
        sha256: sha256Hash,
        dbConnection: tx,
      });

      if (existingDocument) {
        return {
          error: 'File with same content exists',
        };
      }

      // Step 3: Process document content
      const content = await markitdownClient.convertToMarkdown(downloadUrl);
      const chunks = await chunkContent(content, CHUNK_SIZE);

      // Generate AI summary of the first chunk for storage
      const contentSummary =
        chunks.length > 0
          ? await generateDocumentSummary(chunks[0])
          : content.slice(0, 200);

      const updatedDoc = await updateVectorStoreDocument({
        id: parsed.data.documentId,
        updates: {
          content: contentSummary,
          status: 'completed',
          sha256: sha256Hash, // Store the SHA256 hash
        },
        userId: session.user.id,
        dbConnection: tx,
      });

      // Step 4: Add to vector store for search
      const vectorStore = createVectorStoreClient();
      const vectorStorePromises = chunks.map(async (chunk) => {
        await vectorStore.addDocument({
          id: crypto.randomUUID(),
          content: chunk,
          metadata: {
            userId: session.user.id,
            key: document.key || '',
            uploadTimestamp: new Date().toISOString(),
            mimeType: document.mimeType,
            documentId: document.id,
          },
        });
      });
      await Promise.all(vectorStorePromises);

      // Track successful document upload
      track('user_upload_document', {
        documentId: document.id,
        mimeType: document.mimeType,
        userId: session.user.id,
        chunkCount: chunks.length,
      });

      return updatedDoc;
    });
    return {};
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    console.error('Document completion error:', error);
    throw new ChatSDKError(
      'bad_request:api',
      'Failed to complete document upload',
    );
  }
}

/**
 * Server action to delete a document
 */
export async function deleteDocument({ id }: { id: string }) {
  const session = await auth();

  if (!session?.user) {
    throw new ChatSDKError('unauthorized:document');
  }

  const parsed = DeleteDocumentSchema.safeParse({ id });

  if (!parsed.success) {
    throw new ChatSDKError('bad_request:api', 'Invalid document ID');
  }

  try {
    await db.transaction(async (tx) => {
      // First, get the document to check ownership and get S3 key
      const documents = await getDocumentsByIds({
        ids: [parsed.data.id],
        dbConnection: tx,
        userId: session.user.id,
      });

      if (documents.length === 0) {
        throw new ChatSDKError('not_found:document', 'Document not found');
      }

      const document = documents[0];

      if (document.userId !== session.user.id) {
        throw new ChatSDKError('forbidden:document', 'Access denied');
      }

      // Run all deletion operations in parallel
      const deletionPromises = [
        // Delete from database
        deleteDocumentById({
          id: parsed.data.id,
          userId: session.user.id,
          dbConnection: tx,
        }),

        // Delete from S3 if key exists
        document.key
          ? (async () => {
              try {
                const s3Client = new S3Client();
                if (document.key) {
                  await s3Client.deleteFile(document.key);
                }
              } catch (s3Error) {
                console.error('S3 deletion error:', s3Error);
                // Don't throw, just log the error
              }
            })()
          : Promise.resolve(),

        // Delete from vector store
        (async () => {
          try {
            const vectorStore = createVectorStoreClient();
            await vectorStore.deleteDocument(parsed.data.id);
          } catch (vectorError) {
            console.error('Vector store deletion error:', vectorError);
            // Don't throw, just log the error
          }
        })(),
      ];

      await Promise.allSettled(deletionPromises);
    });

    // Note: Removed revalidatePath to prevent page refresh
    // The frontend handles optimistic updates via SWR cache mutations

    return { success: true };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    console.error('Document deletion error:', error);
    throw new ChatSDKError('bad_request:api', 'Failed to delete document');
  }
}

/**
 * Server action to rename a document
 */
export async function renameDocument({
  id,
  newName,
}: {
  id: string;
  newName: string;
}): Promise<{ success: boolean } | { error: string }> {
  const session = await auth();

  if (!session?.user) {
    return {
      error: 'Unauthorized: You must be logged in to rename documents.',
    };
  }

  const parsed = RenameDocumentSchema.safeParse({ id, newName });

  if (!parsed.success) {
    return {
      error: 'Bad Request: Invalid document ID or name.',
    };
  }

  try {
    await db.transaction(async (tx) => {
      // First, get the document to check ownership
      const documents = await getDocumentsByIds({
        ids: [parsed.data.id],
        dbConnection: tx,
        userId: session.user.id,
      });

      if (documents.length === 0) {
        return {
          error: 'Not Found: Document not found.',
        };
      }

      const document = documents[0];

      if (document.userId !== session.user.id) {
        return {
          error:
            'Forbidden: You do not have permission to rename this document.',
        };
      }

      // Update document name in database only
      await updateVectorStoreDocument({
        id: parsed.data.id,
        updates: {
          originalFileName: parsed.data.newName.trim(),
        },
        userId: session.user.id,
        dbConnection: tx,
      });
    });

    return { success: true };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    console.error('Document rename error:', error);
    throw new ChatSDKError('bad_request:api', 'Failed to rename document');
  }
}

export async function getPresignedDownloadUrl({
  documentId,
}: {
  documentId: string;
}): Promise<{ url: string; key: string } | { error: string }> {
  const session = await auth();
  if (!documentId) {
    return { error: 'Bad Request: Document ID is required' };
  }

  if (!session?.user) {
    return {
      error: 'Unauthorized: You must be logged in to download documents.',
    };
  }

  try {
    const document = await getVectorStoreDocumentById({
      id: documentId,
    });

    if (!document) {
      return { error: 'Not Found: Document does not exist' };
    }

    if (document.userId !== session.user.id) {
      return {
        error:
          'Forbidden: You do not have permission to download this document',
      };
    }

    if (!document.key) {
      return { error: 'This file is not available for download' };
    }
    const s3Client = createS3Client();
    const url = await s3Client.getFileUrl(document.key, { ttl: 3600 }); // 1 hour TTL for download URL

    return { url, key: document.key };
  } catch (error) {
    console.error('Error getting presigned download URL:', error);
    return { error: 'Failed to get download URL' };
  }
}

/**
 * Server action to get document content by ID for viewing
 */
export async function getDocumentContent({
  id,
}: {
  id: string;
}): Promise<OnStep | { error: string }> {
  const session = await auth();

  if (!session?.user) {
    return {
      error: 'Unauthorized: You must be logged in to view documents.',
    };
  }

  try {
    const document = await getDocumentById({ id });

    if (!document) {
      return { error: 'Not Found: Document does not exist' };
    }

    if (document.userId !== session.user.id) {
      return {
        error: 'Forbidden: You do not have permission to view this document',
      };
    }

    // Return the content if available
    if (document.content) {
      const parsed = JSON.parse(document.content);
      const content = OnStepSchema.parse(parsed);
      return content;
    }

    return { error: 'Document content is not available' };
  } catch (error) {
    console.error('Error getting document content:', error);
    return { error: 'Failed to get document content' };
  }
}

/**
 * Server action to toggle document visibility
 */
export async function toggleDocumentVisibility({
  id,
  visibility,
}: {
  id: string;
  visibility: 'public' | 'private';
}): Promise<{ success: boolean } | { error: string }> {
  const session = await auth();

  if (!session?.user) {
    return {
      error:
        'Unauthorized: You must be logged in to change document visibility.',
    };
  }

  const parsed = UpdateVisibilitySchema.safeParse({ id, visibility });

  if (!parsed.success) {
    return {
      error: 'Bad Request: Invalid document ID or visibility setting.',
    };
  }

  try {
    const updatedDoc = await updateDocumentVisibility({
      id: parsed.data.id,
      visibility: parsed.data.visibility,
      userId: session.user.id,
    });

    if (!updatedDoc) {
      return {
        error: 'Not Found: Document not found or access denied.',
      };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    console.error('Document visibility update error:', error);
    throw new ChatSDKError(
      'bad_request:api',
      'Failed to update document visibility',
    );
  }
}
