import { createMemoryClient } from './index';

// Mock mem0ai module
jest.mock('mem0ai', () => {
  return jest.fn().mockImplementation((apiKey) => {
    if (!apiKey) {
      throw new Error('Mem0 API key is required');
    }
    return {
      add: jest.fn(),
      search: jest.fn(),
      getAll: jest.fn(),
      delete: jest.fn(),
    };
  });
});

describe('Memory Client Factory', () => {
  afterEach(() => {
    process.env.MEM_ZERO_AI_API_KEY = undefined;
  });

  it('should create memory client when API key is provided', () => {
    process.env.MEM_ZERO_AI_API_KEY = 'test-api-key';

    expect(() => createMemoryClient()).not.toThrow();

    const client = createMemoryClient();
    expect(client).toBeDefined();
    expect(typeof client.add).toBe('function');
    expect(typeof client.search).toBe('function');
    expect(typeof client.getAll).toBe('function');
    expect(typeof client.delete).toBe('function');
  });

  it('should throw error when API key is missing', () => {
    delete process.env.MEM_ZERO_AI_API_KEY;

    expect(() => createMemoryClient()).toThrow(
      'MEM_ZERO_AI_API_KEY environment variable is required',
    );
  });
});
