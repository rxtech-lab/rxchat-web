import { Mem0AIClient } from './mem0ai-client';
import type { MemoryMessage } from './types';

// Mock the actual functions that will be called
const mockAdd = jest.fn();
const mockSearch = jest.fn();
const mockGetAll = jest.fn();
const mockDelete = jest.fn();

// Mock mem0ai module
jest.mock('mem0ai', () => {
  return jest.fn().mockImplementation(() => ({
    add: mockAdd,
    search: mockSearch,
    getAll: mockGetAll,
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
    delete process.env.MEM_ZERO_AI_API_KEY;
  });

  describe('constructor', () => {
    it('should throw error when MEM_ZERO_AI_API_KEY is not provided', () => {
      delete process.env.MEM_ZERO_AI_API_KEY;
      expect(() => new Mem0AIClient()).toThrow(
        'MEM_ZERO_AI_API_KEY environment variable is required',
      );
    });

    it('should initialize with API key', () => {
      process.env.MEM_ZERO_AI_API_KEY = 'test-key';
      expect(() => new Mem0AIClient()).not.toThrow();
    });
  });

  describe('add', () => {
    it('should add messages to memory successfully', async () => {
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
      });
      expect(result).toEqual({
        message: 'Messages added to memory successfully',
        results: [{ id: '1', event: 'ADD', data: 'memory added' }],
      });
    });

    it('should handle errors when adding messages', async () => {
      const messages: MemoryMessage[] = [{ role: 'user', content: 'Hello' }];
      const options = { user_id: 'user123' };

      mockAdd.mockRejectedValue(new Error('API Error'));

      await expect(client.add(messages, options)).rejects.toThrow(
        'Failed to add messages to memory: API Error',
      );
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

      mockSearch.mockRejectedValue(new Error('Search failed'));

      await expect(client.search(query, options)).rejects.toThrow(
        'Failed to search memory: Search failed',
      );
    });
  });

  describe('getAll', () => {
    it('should get all memories for a user', async () => {
      const userId = 'user123';

      mockGetAll.mockResolvedValue([
        {
          id: '1',
          memory: 'User preference 1',
          metadata: { type: 'preference' },
        },
        {
          id: '2',
          memory: 'User preference 2',
          metadata: { type: 'preference' },
        },
      ]);

      const result = await client.getAll(userId);

      expect(mockGetAll).toHaveBeenCalledWith({ user_id: userId });
      expect(result).toEqual([
        {
          id: '1',
          text: 'User preference 1',
          score: 1.0,
          metadata: { type: 'preference' },
        },
        {
          id: '2',
          text: 'User preference 2',
          score: 1.0,
          metadata: { type: 'preference' },
        },
      ]);
    });
  });

  describe('delete', () => {
    it('should delete a memory successfully', async () => {
      const memoryId = 'memory123';

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
