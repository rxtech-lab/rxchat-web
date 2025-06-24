import { agent } from './agent';

// Add mocks for external dependencies
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject, generateText } from 'ai';
import nock from 'nock';
import { createMCPClient } from '../ai/mcp';

// Mock the external dependencies
jest.mock('ai');
jest.mock('../ai/mcp');
jest.mock('@openrouter/ai-sdk-provider');
jest.mock('uuid', () => ({
  v4: jest.fn(() => '123e4567-e89b-12d3-a456-426614174000'),
}));

const mockGenerateText = generateText as jest.MockedFunction<
  typeof generateText
>;
const mockGenerateObject = generateObject as jest.MockedFunction<
  typeof generateObject
>;
const mockCreateMCPClient = createMCPClient as jest.MockedFunction<
  typeof createMCPClient
>;
const mockCreateOpenRouter = createOpenRouter as jest.MockedFunction<
  typeof createOpenRouter
>;

describe('agent should handle the compilation errors', () => {
  let mockMcpClient: any;
  let mockModel: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    process.env.MCP_ROUTER_SERVER_API_KEY = 'test-api';
    process.env.MCP_ROUTER_SERVER_URL = 'http://mcp-router:3000';

    nock('http://mcp-router:3000')
      .persist() // Keep the mock active for all tests
      .get('/tools/check')
      .query(true) // Match any query parameters
      .matchHeader('x-api-key', 'test-api')
      .reply(200, {
        exists: true,
      });

    // Mock MCP client
    mockMcpClient = {
      tools: jest.fn().mockResolvedValue({
        searchTool: {
          description: 'Search tool',
          parameters: { query: { type: 'string' } },
        },
        cryptoTool: {
          description: 'Crypto trading tool',
          parameters: { symbol: { type: 'string' } },
        },
      }),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Mock model
    mockModel = jest.fn();

    // Setup mocks
    mockCreateMCPClient.mockResolvedValue(mockMcpClient);
    // Mock OpenRouter to return a function that returns models when called with model names
    const mockOpenRouterFunction = jest.fn().mockReturnValue(mockModel);
    mockCreateOpenRouter.mockReturnValue(mockOpenRouterFunction as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should handle MCP client creation failure', async () => {
    // Mock MCP client creation failure
    mockCreateMCPClient.mockRejectedValue(
      new Error('Failed to create MCP client'),
    );

    // Use a try-catch to handle the potential error
    try {
      const result = await agent('Create any workflow');
      // Should handle the error gracefully and return undefined
      expect(result).toBeUndefined();
    } catch (error) {
      // If the agent throws an error, that's also acceptable behavior
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Failed to create MCP client');
    }
  });
});
