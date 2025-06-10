import { Mem0AIClient } from './mem0ai-client';
import type { MemoryMessage } from './types';

// Mock the actual functions that will be called
const mockAdd = jest.fn();
const mockSearch = jest.fn();

const mockDelete = jest.fn();

// Mock mem0ai module
jest.mock('mem0ai', () => {
  return jest.fn().mockImplementation(() => ({
    add: mockAdd,
    search: mockSearch,
    delete: mockDelete,
  }));
});

describe('Mem0AIClient', () => {
  let client: Mem0AIClient;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MEM_ZERO_AI_API_KEY = 'test-api-key';
    client = new Mem0AIClient();
  });

  afterEach(() => {
    process.env.MEM_ZERO_AI_API_KEY = undefined;
  });

  describe('constructor', () => {
    it('should initialize with API key', () => {
      process.env.MEM_ZERO_AI_API_KEY = 'test-key';
      expect(() => new Mem0AIClient()).not.toThrow();
    });
  });

  describe('add', () => {
    it('should add messages to memory successfully', async () => {
      const client = new Mem0AIClient();
      const messages: MemoryMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      const options = { user_id: 'user123' };

      mockAdd.mockResolvedValue([
        { id: '1', event: 'ADD', memory: 'memory added' },
      ]);

      const result = await client.add(messages, options);

      expect(mockAdd).toHaveBeenCalledWith(messages, {
        user_id: 'user123',
        enable_graph: true,
      });
      expect(result).toEqual({
        message: 'Messages added to memory successfully',
        results: [{ id: '1', event: 'ADD', data: 'memory added' }],
      });
    });

    it('should handle errors when adding messages', async () => {
      const client = new Mem0AIClient();
      const messages: MemoryMessage[] = [{ role: 'user', content: 'Hello' }];
      const options = { user_id: 'user123' };

      mockAdd.mockRejectedValue(new Error('API Error'));

      await expect(client.add(messages, options)).rejects.toThrow(
        'Failed to add messages to memory: API Error',
      );
    });

    it('should add all messages when context size is under 10K tokens', async () => {
      const client = new Mem0AIClient();
      const messages: MemoryMessage[] = [
        { role: 'user', content: 'Short message' },
        { role: 'assistant', content: 'Short response' },
        { role: 'user', content: 'Another short message' },
      ];
      const options = { user_id: 'user123' };

      mockAdd.mockResolvedValue([
        { id: '1', event: 'ADD', memory: 'memory added' },
      ]);

      const result = await client.add(messages, options);

      // Should add all messages since context is small
      expect(mockAdd).toHaveBeenCalledWith(messages, {
        user_id: 'user123',
        enable_graph: true,
      });
      expect(result).toEqual({
        message: 'Messages added to memory successfully',
        results: [{ id: '1', event: 'ADD', data: 'memory added' }],
      });
    });

    it('should only include current query when context size exceeds 10K tokens', async () => {
      // Create a message that would exceed 10K tokens (40K characters ≈ 10K tokens)
      const client = new Mem0AIClient();
      const longContent = 'a'.repeat(40000);
      const messages: MemoryMessage[] = [
        { role: 'user', content: 'First user message' },
        { role: 'assistant', content: longContent },
        { role: 'user', content: 'Current query' },
      ];
      const options = { user_id: 'user123' };

      // Spy on console.log to verify the warning message
      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      mockAdd.mockResolvedValue([
        { id: '1', event: 'ADD', memory: 'memory added' },
      ]);

      const result = await client.add(messages, options);

      // Should only add the current query (last user message)
      expect(mockAdd).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Current query' }],
        {
          user_id: 'user123',
          enable_graph: true,
        },
      );
      expect(result).toEqual({
        message: 'Messages added to memory successfully',
        results: [{ id: '1', event: 'ADD', data: 'memory added' }],
      });

      // Verify warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /Context size.*tokens\) exceeds limit \(10000\)\. Using current query only\./,
        ),
      );

      consoleSpy.mockRestore();
    });

    it('should handle case with no user messages when context exceeds limit', async () => {
      // Create a message that would exceed 10K tokens but has no user messages
      const client = new Mem0AIClient();
      const longContent = 'a'.repeat(40000);
      const messages: MemoryMessage[] = [
        { role: 'assistant', content: longContent },
      ];
      const options = { user_id: 'user123' };

      mockAdd.mockResolvedValue([
        { id: '1', event: 'ADD', memory: 'memory added' },
      ]);

      const result = await client.add(messages, options);

      // Should still add all messages since there's no user message to extract
      expect(mockAdd).toHaveBeenCalledWith(messages, {
        user_id: 'user123',
        enable_graph: true,
      });
      expect(result).toEqual({
        message: 'Messages added to memory successfully',
        results: [{ id: '1', event: 'ADD', data: 'memory added' }],
      });
    });

    it('should use the last user message when multiple user messages exist and context exceeds limit', async () => {
      // Create messages that would exceed 10K tokens with multiple user messages
      const client = new Mem0AIClient();
      const longContent = 'a'.repeat(20000);
      const messages: MemoryMessage[] = [
        { role: 'user', content: 'First user message' },
        { role: 'assistant', content: longContent },
        { role: 'user', content: 'Second user message' },
        { role: 'assistant', content: longContent },
        { role: 'user', content: 'Latest user query' },
      ];
      const options = { user_id: 'user123' };

      mockAdd.mockResolvedValue([
        { id: '1', event: 'ADD', memory: 'memory added' },
      ]);

      const result = await client.add(messages, options);

      // Should only add the latest user message
      expect(mockAdd).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Latest user query' }],
        {
          user_id: 'user123',
          enable_graph: true,
        },
      );
      expect(result).toEqual({
        message: 'Messages added to memory successfully',
        results: [{ id: '1', event: 'ADD', data: 'memory added' }],
      });
    });
  });

  describe('search', () => {
    it('should search memories successfully', async () => {
      const query = 'pizza recommendation';
      const options = {
        user_id: 'user123',
        version: 'v2',
        filters: { AND: [{ user_id: 'user123' }] },
      };

      mockSearch.mockResolvedValue([
        {
          id: '1',
          memory: 'User likes pepperoni pizza',
          score: 0.9,
          metadata: { type: 'preference' },
        },
      ]);

      const result = await client.search(query, options);

      expect(mockSearch).toHaveBeenCalledWith(query, {
        user_id: 'user123',
        version: 'v2',
        enable_graph: true,
        filters: { AND: [{ user_id: 'user123' }] },
      });
      expect(result).toEqual({
        results: [
          {
            id: '1',
            text: 'User likes pepperoni pizza',
            score: 0.9,
            metadata: { type: 'preference' },
          },
        ],
      });
    });

    it('should handle search errors', async () => {
      const query = 'test query';
      const options = { user_id: 'user123' };
      const client = new Mem0AIClient();

      mockSearch.mockRejectedValue(new Error('Search failed'));

      await expect(client.search(query, options)).rejects.toThrow(
        'Failed to search memory: Search failed',
      );
    });
  });

  describe('delete', () => {
    it('should delete a memory successfully', async () => {
      const memoryId = 'memory123';
      const client = new Mem0AIClient();

      mockDelete.mockResolvedValue({});

      await client.delete(memoryId);

      expect(mockDelete).toHaveBeenCalledWith(memoryId);
    });

    it('should handle delete errors', async () => {
      const memoryId = 'memory123';

      mockDelete.mockRejectedValue(new Error('Delete failed'));

      await expect(client.delete(memoryId)).rejects.toThrow(
        'Failed to delete memory: Delete failed',
      );
    });
  });
});
