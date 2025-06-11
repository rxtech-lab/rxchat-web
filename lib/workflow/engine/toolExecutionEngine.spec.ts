import nock from 'nock';
import { McpToolExecutionEngine } from './toolExecutionEngine';

describe('McpToolExecutionEngine', () => {
  const mockServerUrl = 'http://test-mcp-router.com';
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    // Clean all HTTP mocks before each test
    nock.cleanAll();
  });

  afterEach(() => {
    // Clean all HTTP mocks after each test
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('should create an instance with provided parameters', () => {
      const engine = new McpToolExecutionEngine(mockServerUrl, mockApiKey);
      expect(engine).toBeInstanceOf(McpToolExecutionEngine);
    });
  });

  describe('execute', () => {
    let engine: McpToolExecutionEngine;

    beforeEach(() => {
      engine = new McpToolExecutionEngine(mockServerUrl, mockApiKey);
    });

    it('should successfully execute a tool and return output', async () => {
      const toolName = 'test-tool';
      const toolInput = { param1: 'value1', param2: 'value2' };
      const expectedOutput = { result: 'success', data: 'test-data' };

      // Mock the HTTP request
      nock(mockServerUrl)
        .post('/tool/test-tool/use')
        .matchHeader('x-api-key', mockApiKey)
        .reply(200, { output: expectedOutput });

      const result = await engine.execute(toolName, toolInput);

      expect(result).toEqual(expectedOutput);
    });

    it('should throw error when server responds with non-200 status', async () => {
      const toolName = 'failing-tool';
      const toolInput = { param: 'value' };

      // Mock server error response
      nock(mockServerUrl)
        .post('/tool/failing-tool/use')
        .reply(500, { error: 'Internal Server Error' });

      await expect(engine.execute(toolName, toolInput)).rejects.toThrow(
        'Failed to execute tool',
      );
    });

    it('should throw error when server responds with 404', async () => {
      const toolName = 'nonexistent-tool';
      const toolInput = { param: 'value' };

      // Mock 404 response
      nock(mockServerUrl)
        .post('/tool/nonexistent-tool/use')
        .reply(404, { error: 'Tool not found' });

      await expect(engine.execute(toolName, toolInput)).rejects.toThrow(
        'Failed to execute tool',
      );
    });

    it('should throw error when response has no output field', async () => {
      const toolName = 'incomplete-tool';
      const toolInput = { param: 'value' };

      // Mock response without output field
      nock(mockServerUrl)
        .post('/tool/incomplete-tool/use')
        .reply(200, { status: 'success' }); // Missing 'output' field

      await expect(engine.execute(toolName, toolInput)).rejects.toThrow(
        'No output from tool',
      );
    });

    it('should throw error when response has null output', async () => {
      const toolName = 'null-output-tool';
      const toolInput = { param: 'value' };

      // Mock response with null output
      nock(mockServerUrl)
        .post('/tool/null-output-tool/use')
        .reply(200, { output: null });

      await expect(engine.execute(toolName, toolInput)).rejects.toThrow(
        'No output from tool',
      );
    });

    it('should handle complex input objects', async () => {
      const toolName = 'complex-tool';
      const toolInput = {
        config: {
          nested: {
            values: [1, 2, 3],
          },
        },
        metadata: {
          timestamp: '2024-01-01T00:00:00Z',
          version: '1.0.0',
        },
      };
      const expectedOutput = { processed: true };

      let capturedInput: any;

      nock(mockServerUrl)
        .post('/tool/complex-tool/use')
        .reply((uri, body) => {
          capturedInput = JSON.parse(body as string).input;
          return [200, { output: expectedOutput }];
        });

      const result = await engine.execute(toolName, toolInput);

      expect(capturedInput).toEqual(toolInput);
      expect(result).toEqual(expectedOutput);
    });

    it('should handle network errors', async () => {
      const toolName = 'network-fail-tool';
      const toolInput = { param: 'value' };

      // Mock network error
      nock(mockServerUrl)
        .post('/tool/network-fail-tool/use')
        .replyWithError('Network error');

      await expect(engine.execute(toolName, toolInput)).rejects.toThrow(
        'Network error',
      );
    });

    it('should handle malformed JSON response', async () => {
      const toolName = 'malformed-tool';
      const toolInput = { param: 'value' };

      // Mock response with invalid JSON
      nock(mockServerUrl).post('/').reply(200, 'invalid json response');

      await expect(engine.execute(toolName, toolInput)).rejects.toThrow();
    });
  });
});
