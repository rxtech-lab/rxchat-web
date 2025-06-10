import { default as Mem0Client } from 'mem0ai';
import type {
  AddMemoryOptions,
  AddMemoryResponse,
  MemoryClient as IMemoryClient,
  MemoryMessage,
  SearchMemoryOptions,
  SearchMemoryResponse,
} from './types';

// Maximum context size in tokens before limiting message history
const MAX_CONTEXT_SIZE_TOKENS = 10000;

/**
 * Estimate token count from memory messages based on text content
 * Uses rough approximation: 1 token ≈ 4 characters
 * @param messages - Array of memory messages to count tokens for
 * @returns Estimated token count
 */
function estimateMemoryTokenCount(messages: MemoryMessage[]): number {
  let totalChars = 0;

  for (const message of messages) {
    if (typeof message.content === 'string') {
      totalChars += message.content.length;
    }
  }

  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(totalChars / 4);
}

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

    // Initialize client
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
      // Estimate token count for the messages
      const estimatedTokens = estimateMemoryTokenCount(messages);

      let messagesToAdd = messages;

      // If context size exceeds limit, only include the current query (last user message)
      // and rely on memory context for historical information
      if (estimatedTokens > MAX_CONTEXT_SIZE_TOKENS) {
        // Find the last user message (current query)
        const currentQuery = messages
          .filter((msg) => msg.role === 'user')
          .pop();

        if (currentQuery) {
          // Only include the current query, not the whole history
          messagesToAdd = [currentQuery];
          console.log(
            `Context size (${estimatedTokens} tokens) exceeds limit (${MAX_CONTEXT_SIZE_TOKENS}). Using current query only.`,
          );
        }
      }

      const response = await this.client.add(messagesToAdd, {
        user_id: options.user_id,
        ...options.metadata,
        enable_graph: true,
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
        // Enable graph memory for enhanced relationship tracking
        // See: https://docs.mem0.ai/platform/features/graph-memory
        enable_graph: true,
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
