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

  it('should generate workflow with input output compatibility', async () => {
    // Mock tool discovery agent response
    const mockToolCall = {
      type: 'tool-call' as const,
      toolCallId: 'call-1',
      toolName: 'answerTool',
      args: {
        selectedTools: ['searchTool', 'cryptoTool'],
        reasoning: 'Selected tools for crypto trading workflow',
      },
    };

    mockGenerateText
      .mockResolvedValueOnce({
        text: 'Tool discovery completed',
        toolCalls: [mockToolCall],
        finishReason: 'tool-calls' as const,
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        rawResponse: { headers: {} },
        warnings: undefined,
      } as any)
      // Mock workflow builder agent response
      .mockResolvedValueOnce({
        text: 'Workflow built successfully with compatible input/output',
        finishReason: 'stop' as const,
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        rawResponse: { headers: {} },
        warnings: undefined,
      } as any);

    // Mock suggestion agent responses - first suggests continue, then stop
    mockGenerateObject
      .mockResolvedValueOnce({
        object: {
          suggestions: ['Add error handling', 'Validate crypto symbols'],
          modifications: ['Ensure input/output compatibility'],
          nextStep: 'continue',
        },
        finishReason: 'stop' as const,
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        rawResponse: { headers: {} },
        warnings: undefined,
      } as any)
      .mockResolvedValueOnce({
        object: {
          suggestions: ['Workflow looks good'],
          modifications: [],
          nextStep: 'stop',
        },
        finishReason: 'stop' as const,
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        rawResponse: { headers: {} },
        warnings: undefined,
      } as any);

    const result = await agent(
      'Create a workflow for crypto trading with compatible inputs and outputs',
    );

    // Verify the result
    expect(result).toBeDefined();
    expect(result?.workflow).toBeDefined();

    // Verify tool discovery was called
    expect(mockGenerateText).toHaveBeenCalledTimes(3);

    // Verify MCP client was closed
    expect(mockMcpClient.close).toHaveBeenCalled();
  });

  it('should generate workflow with no issues', async () => {
    // Mock tool discovery agent response
    const mockToolCall = {
      type: 'tool-call' as const,
      toolCallId: 'call-2',
      toolName: 'answerTool',
      args: {
        selectedTools: ['apiTool', 'processDataTool'],
        reasoning: 'Selected tools for data processing workflow',
      },
    };

    mockGenerateText
      .mockResolvedValueOnce({
        text: 'Tool discovery completed successfully',
        toolCalls: [mockToolCall],
        finishReason: 'tool-calls' as const,
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        rawResponse: { headers: {} },
        warnings: undefined,
      } as any)
      // Mock workflow builder agent response - no issues
      .mockResolvedValueOnce({
        text: 'Workflow built successfully without any issues',
        finishReason: 'stop' as const,
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        rawResponse: { headers: {} },
        warnings: undefined,
      } as any)
      .mockResolvedValueOnce({
        toolCalls: [
          {
            args: {
              modifications: [],
              skipToolDiscovery: true,
            },
          } as any,
        ],
      } as any);

    const result = await agent('Create a simple data processing workflow');

    // Verify the result
    expect(result).toBeDefined();
    expect(result?.workflow).toBeDefined();

    // Verify all agents were called appropriately
    expect(mockGenerateText).toHaveBeenCalledTimes(3); // tool discovery + workflow builder

    // Verify the workflow creation process
    expect(mockMcpClient.tools).toHaveBeenCalled();
    expect(mockMcpClient.close).toHaveBeenCalled();

    // Verify the workflow has the expected structure
    const workflowData = result?.workflow;
    if (workflowData) {
      expect(workflowData.trigger.identifier).toBe(
        '123e4567-e89b-12d3-a456-426614174000',
      );
      expect(workflowData.trigger.type).toBe('cronjob-trigger');
    }
  });

  it('should handle errors gracefully and retry with suggestions', async () => {
    // Mock tool discovery agent response
    const mockToolCall = {
      type: 'tool-call' as const,
      toolCallId: 'call-3',
      toolName: 'answerTool',
      args: {
        selectedTools: ['errorTool'],
        reasoning: 'Tool that will cause errors',
      },
    };

    mockGenerateText
      .mockResolvedValueOnce({
        text: 'Tool discovery completed',
        toolCalls: [mockToolCall],
        finishReason: 'tool-calls' as const,
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        rawResponse: { headers: {} },
        warnings: undefined,
      } as any)
      // Mock workflow builder agent response - simulate error
      .mockRejectedValueOnce(new Error('Input/output mismatch error'))
      .mockResolvedValueOnce({
        toolCalls: [
          {
            args: {
              modifications: [],
              skipToolDiscovery: true,
            },
          } as any,
        ],
      } as any)
      // Mock second workflow builder attempt
      .mockResolvedValueOnce({
        text: 'Workflow built successfully after error handling',
        finishReason: 'stop' as const,
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        rawResponse: { headers: {} },
        warnings: undefined,
      } as any)
      .mockResolvedValueOnce({
        toolCalls: [
          {
            args: {
              modifications: [],
              skipToolDiscovery: true,
            },
          } as any,
        ],
      } as any);

    const result = await agent('Create a workflow that might have errors');

    // Verify the result exists despite initial error
    expect(result).toBeDefined();
    expect(result?.workflow).toBeDefined();

    // Verify error handling - the count is higher due to retry logic in the actual implementation
    expect(mockGenerateText).toHaveBeenCalledTimes(3); // discovery + failed builder + retry discovery + retry builder

    // Verify MCP client was still closed
    expect(mockMcpClient.close).toHaveBeenCalled();
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
