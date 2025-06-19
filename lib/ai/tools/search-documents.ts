import {
  searchDocuments,
  searchDocumentsById,
} from '@/lib/document/actions/action_server';
import type { VectorStoreDocument } from '@/lib/db/schema';
import { MAX_K } from '@/lib/constants';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import { z } from 'zod';

interface SearchDocumentsProps {
  session: Session;
}

export const searchDocumentsTool = ({ session }: SearchDocumentsProps) =>
  tool({
    description:
      'Search for documents using vector similarity search based on query text. If documentId is provided, search within that specific document. If user asks about what is in a document or something like that, you should query abstract about this document with the documentId parameter. Returns document metadata and content for AI to analyze.',
    parameters: z.object({
      query: z
        .string()
        .min(1)
        .describe('The search query to find relevant documents'),
      documentId: z
        .string()
        .optional()
        .describe('Optional: Search within a specific document by its ID'),
      limit: z
        .number()
        .min(1)
        .max(MAX_K)
        .optional()
        .describe(`Maximum number of documents to return (default: ${MAX_K})`),
    }),
    execute: async ({ query, documentId, limit = MAX_K }) => {
      try {
        let privateDocuments: VectorStoreDocument[] = [];
        let publicDocuments: VectorStoreDocument[] = [];

        if (documentId) {
          // Search within a specific document
          privateDocuments = await searchDocumentsById({
            documentId,
            query,
            limit,
          });
        } else {
          // Search across all documents
          privateDocuments = await searchDocuments({
            query,
            limit,
          });
          publicDocuments = await searchDocuments({
            query,
            limit,
            visibility: 'public',
          });
        }

        if (privateDocuments.length === 0 && publicDocuments.length === 0) {
          const message = documentId
            ? `No content found in the specified document matching your search query.`
            : 'No documents found matching your search query.';
          return {
            message,
            results: [],
          };
        }

        // Merge private and public documents, dropping duplicates by id
        const mergedDocuments = [
          ...privateDocuments,
          ...publicDocuments.filter(
            (pubDoc) =>
              !privateDocuments.some((privDoc) => privDoc.id === pubDoc.id),
          ),
        ];

        const message = documentId
          ? `Found ${mergedDocuments.length} relevant section(s) in the document matching your search query.`
          : `Found ${mergedDocuments.length} document(s) matching your search query.`;

        return {
          message,
          results: mergedDocuments.map((doc) => ({
            id: doc.id,
            originalFileName: doc.originalFileName,
            mimeType: doc.mimeType,
            size: doc.size,
            createdAt: doc.createdAt,
            content: doc.content,
          })),
        };
      } catch (error) {
        return {
          error: 'Failed to search documents. Please try again.',
          message: 'An error occurred while searching for documents.',
          results: [],
        };
      }
    },
  });
