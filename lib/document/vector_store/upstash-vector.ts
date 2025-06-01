import { Index } from '@upstash/vector';
import type {
  VectorStore,
  VectorStoreDocument,
  VectorStoreMetadata,
  SearchOptions,
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
    await this.index.upsert(
      {
        id: document.id,
        data: document.content, // Upstash will create embeddings from the text data
        metadata: document.metadata as unknown as Record<string, unknown>,
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

    // Add user filter if specified
    if (options?.userId) {
      queryParams.filter = `userId = "${options.userId}"`;
    }

    const results = await this.index.query(queryParams, {
      namespace: 'document',
    });

    return results.map((result) => ({
      id: result.id as string,
      content: result.data as string,
      metadata: result.metadata as unknown as VectorStoreMetadata,
    }));
  }

  /**
   * Deletes a document from the vector store
   * @param id - The id of the document to delete
   */
  async deleteDocument(id: string): Promise<void> {
    await this.index.delete(id, {
      namespace: 'document',
    });
  }
}
