/**
 * Integration test to verify memory functionality is gracefully handled
 * when environment variables are missing (like in test environments)
 */

import { createMemoryClient } from '@/lib/memory';

// Mock mem0ai module for testing
jest.mock('mem0ai', () => {
  return jest.fn().mockImplementation((apiKey) => {
    if (!apiKey) {
      throw new Error('Mem0 API key is required');
    }
    return {
      add: jest.fn(),
      search: jest.fn(),
      delete: jest.fn(),
    };
  });
});

describe('Memory Integration', () => {
  const originalEnv = process.env.MEM_ZERO_AI_API_KEY;

  afterEach(() => {
    if (originalEnv) {
      process.env.MEM_ZERO_AI_API_KEY = originalEnv;
    } else {
      process.env.MEM_ZERO_AI_API_KEY = undefined;
    }
  });

  it('should fail gracefully when MEM_ZERO_AI_API_KEY is not set', () => {
    process.env.MEM_ZERO_AI_API_KEY = undefined;

    expect(() => {
      createMemoryClient();
    }).toThrow('MEM_ZERO_AI_API_KEY environment variable is required');
  });

  it('should work when MEM_ZERO_AI_API_KEY is set', () => {
    process.env.MEM_ZERO_AI_API_KEY = 'test-key';

    expect(() => {
      createMemoryClient();
    }).not.toThrow();
  });
});
