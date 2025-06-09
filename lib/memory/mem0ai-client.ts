import { default as Mem0Client } from 'mem0ai';
import type {
  AddMemoryOptions,
  AddMemoryResponse,
  MemoryClient as IMemoryClient,
  MemoryMessage,
  MemorySearchResult,
  SearchMemoryOptions,
  SearchMemoryResponse,
} from './types';

/**
 * Mem0AI implementation of the memory client
 */
export class Mem0AIClient implements IMemoryClient {
  private client: Mem0Client;

  constructor() {
    const apiKey = process.env.MEM_ZERO_AI_API_KEY;

    if (!apiKey) {
      throw new Error('MEM_ZERO_AI_API_KEY environment variable is required');
    }

    this.client = new Mem0Client({ apiKey });
  }

  /**
   * Add conversation messages to memory
   */
  async add(
    messages: MemoryMessage[],
    options: AddMemoryOptions,
  ): Promise<AddMemoryResponse> {
    try {
      const response = await this.client.add(messages, {
        user_id: options.user_id,
        ...options.metadata,
      });

      return {
        message: 'Messages added to memory successfully',
        results:
          response?.map((memory: any) => ({
            id: memory.id || '',
            event: memory.event || 'ADD',
            data: memory.memory || memory.data || '',
          })) || [],
      };
    } catch (error) {
      console.error('Error adding messages to memory:', error);
      throw new Error(
        `Failed to add messages to memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Search relevant memories for a query
   */
  async search(
    query: string,
    options: SearchMemoryOptions,
  ): Promise<SearchMemoryResponse> {
    try {
      const searchOptions: any = {
        user_id: options.user_id,
      };

      if (options.limit) {
        searchOptions.limit = options.limit;
      }

      if (options.filters) {
        searchOptions.filters = options.filters;
      }

      if (options.version) {
        searchOptions.version = options.version;
      }

      const response = await this.client.search(query, searchOptions);

      return {
        results:
          response?.map((result: any) => ({
            id: result.id || '',
            text: result.memory || result.text || '',
            score: result.score || 0,
            metadata: result.metadata || {},
          })) || [],
      };
    } catch (error) {
      console.error('Error searching memory:', error);
      throw new Error(
        `Failed to search memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all memories for a user
   */
  async getAll(userId: string): Promise<MemorySearchResult[]> {
    try {
      const response = await this.client.getAll({ user_id: userId });

      return (
        response?.map((result: any) => ({
          id: result.id || '',
          text: result.memory || result.text || '',
          score: 1.0, // Default score since getAll doesn't provide scores
          metadata: result.metadata || {},
        })) || []
      );
    } catch (error) {
      console.error('Error getting all memories:', error);
      throw new Error(
        `Failed to get all memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete a specific memory
   */
  async delete(memoryId: string): Promise<void> {
    try {
      await this.client.delete(memoryId);
    } catch (error) {
      console.error('Error deleting memory:', error);
      throw new Error(
        `Failed to delete memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
