import { Index } from '@upstash/vector';
import { generateUUID } from '@/lib/utils';
import type {
  VectorStore,
  VectorStoreDocument,
  VectorStoreMetadata,
  SearchOptions,
  SearchByDocumentIdOptions,
} from './types';

/**
 * Implementation of VectorStore using Upstash Vector database
 */
export class UpstashVectorStore implements VectorStore {
  private index: Index;

  /**
   * Creates a new UpstashVectorStore instance
   * @param index - The Upstash Vector index instance
   */
  constructor() {
    this.index = new Index({
      url: process.env.UPSTASH_VECTOR_URL,
      token: process.env.UPSTASH_VECTOR_TOKEN,
    });
  }

  /**
   * Adds a document to the vector store
   * @param document - The document to add
   */
  async addDocument(document: VectorStoreDocument): Promise<void> {
    // Generate unique vector store ID instead of using document ID
    const vectorStoreId = generateUUID();

    // Include original document ID in metadata
    const metadata = {
      ...document.metadata,
    } as unknown as Record<string, unknown>;

    await this.index.upsert(
      {
        id: vectorStoreId,
        data: document.content, // Upstash will create embeddings from the text data
        metadata,
      },
      {
        namespace: 'document',
      },
    );
  }

  /**
   * Searches for documents similar to the query
   * @param query - The search query text
   * @param options - Search options including limit and userId filter
   * @returns Array of matching documents
   */
  async searchDocument(
    query: string,
    options?: SearchOptions,
  ): Promise<VectorStoreDocument[]> {
    const topK = options?.limit || 10;

    const queryParams: any = {
      data: query, // Use text query, Upstash will convert to embeddings
      topK,
      includeMetadata: true,
      includeData: true,
    };

    // only filter by userId if visibility is private
    if (options?.userId && options.visibility === 'private') {
      queryParams.filter = `userId = "${options.userId}"`;
    }

    const results = await this.index.query(queryParams, {
      namespace: 'document',
    });

    return results.map((result) => {
      const metadata = result.metadata as unknown as VectorStoreMetadata;
      return {
        // Use documentId from metadata if available, otherwise fall back to vector store ID for backward compatibility
        id: metadata.documentId || (result.id as string),
        content: result.data as string,
        metadata,
      };
    });
  }

  /**
   * Searches for documents by document ID and query text
   * @param documentId - The specific document ID to search within
   * @param query - The search query text
   * @param options - Search options including limit and userId filter
   * @returns Array of matching documents
   */
  async searchDocumentById(
    documentId: string,
    query: string,
    options?: SearchByDocumentIdOptions,
  ): Promise<VectorStoreDocument[]> {
    const topK = options?.limit || 10;

    const queryParams: any = {
      data: query, // Use text query, Upstash will convert to embeddings
      topK,
      includeMetadata: true,
      includeData: true,
    };

    // Filter by both documentId and userId if specified
    const filters = [`documentId = "${documentId}"`];
    if (options?.userId) {
      filters.push(`userId = "${options.userId}"`);
    }
    queryParams.filter = filters.join(' AND ');

    const results = await this.index.query(queryParams, {
      namespace: 'document',
    });

    return results.map((result) => {
      const metadata = result.metadata as unknown as VectorStoreMetadata;
      return {
        // Use documentId from metadata if available, otherwise fall back to vector store ID for backward compatibility
        id: metadata.documentId || (result.id as string),
        content: result.data as string,
        metadata,
      };
    });
  }

  /**
   * Deletes a document from the vector store
   * @param id - The original document id from database to delete
   */
  async deleteDocument(id: string): Promise<void> {
    // Use filter to delete by documentId metadata instead of vector store ID
    await this.index.delete(
      {
        filter: `documentId = "${id}"`,
      },
      {
        namespace: 'document',
      },
    );
  }
}
