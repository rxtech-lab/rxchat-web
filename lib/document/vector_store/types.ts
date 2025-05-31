export interface VectorStoreMetadata {
  /**
   * The id of the user who uploaded the document
   */
  userId: string;
  /**
   * The key of the document in the S3 bucket
   */
  key: string;
  /**
   * The timestamp of the document upload
   */
  uploadTimestamp: string;

  /**
   * The mime type of the document
   */
  mimeType: string;
}

/**
 * A document in the vector store
 */
export interface VectorStoreDocument {
  /**
   * The id of the document (In the database)
   */
  id: string;
  /**
   * The content of the document
   */
  content: string;
  /**
   * The metadata of the document
   */
  metadata: VectorStoreMetadata;
}

export interface SearchOptions {
  limit?: number;
  userId?: string;
}

export interface VectorStore {
  addDocument(document: VectorStoreDocument): Promise<void>;
  search(
    query: string,
    options?: SearchOptions,
  ): Promise<VectorStoreDocument[]>;
  deleteDocument(id: string): Promise<void>;
}
