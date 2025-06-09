/**
 * Message structure for memory operations - matches the format used by mem0ai
 */
export interface MemoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Options for adding messages to memory
 */
export interface AddMemoryOptions {
  user_id: string;
  metadata?: Record<string, any>;
}

/**
 * Options for searching memory
 */
export interface SearchMemoryOptions {
  user_id: string;
  limit?: number;
  filters?: {
    AND?: Array<Record<string, any>>;
    OR?: Array<Record<string, any>>;
  };
  version?: string;
}

/**
 * Memory search result
 */
export interface MemorySearchResult {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * Response from adding memories
 */
export interface AddMemoryResponse {
  message: string;
  results?: Array<{
    id: string;
    event: string;
    data: string;
  }>;
}

/**
 * Response from searching memories
 */
export interface SearchMemoryResponse {
  results: MemorySearchResult[];
}

/**
 * Abstract interface for memory client implementations
 */
export interface MemoryClient {
  /**
   * Add conversation messages to memory
   */
  add(
    messages: MemoryMessage[],
    options: AddMemoryOptions,
  ): Promise<AddMemoryResponse>;

  /**
   * Search relevant memories for a query
   */
  search(
    query: string,
    options: SearchMemoryOptions,
  ): Promise<SearchMemoryResponse>;

  /**
   * Get all memories for a user
   */
  getAll(userId: string): Promise<MemorySearchResult[]>;

  /**
   * Delete a specific memory
   */
  delete(memoryId: string): Promise<void>;
}
