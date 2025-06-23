import nock from 'nock';
import { TestToolExecutionEngine } from './testToolExecutionEngine';

describe('TestToolExecutionEngine', () => {
  let engine: TestToolExecutionEngine;
  const mockServerUrl = 'http://test-mcp-router.com';
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    engine = new TestToolExecutionEngine(
      () => ({ mode: 'test', result: null }),
      mockServerUrl,
      mockApiKey,
    );
    // Clean all HTTP mocks before each test
    nock.cleanAll();
  });

  afterEach(() => {
    // Clean all HTTP mocks after each test
    nock.cleanAll();
  });

  describe('execute', () => {
    it('should handle nested JSON schemas correctly', async () => {
      const tool = 'test-tool';
      const inputSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number', minimum: 0, maximum: 120 },
              email: { type: 'string', format: 'email' },
              preferences: {
                type: 'object',
                properties: {
                  theme: { type: 'string', enum: ['light', 'dark'] },
                  notifications: { type: 'boolean' },
                  tags: {
                    type: 'array',
                    items: { type: 'string' },
                    minItems: 1,
                    maxItems: 3,
                  },
                },
                required: ['theme'],
              },
            },
            required: ['name', 'age', 'email'],
          },
          metadata: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              id: { type: 'string', format: 'uuid' },
            },
            required: ['timestamp'],
          },
        },
        required: ['user'],
      };

      const outputSchema = {
        type: 'object',
        required: ['status', 'data'],
        properties: {
          status: { type: 'string', enum: ['success', 'error'] },
          data: {
            type: 'object',
            required: ['processedAt', 'result'],
            properties: {
              processedAt: { type: 'string', format: 'date-time' },
              result: {
                type: 'object',
                required: ['score', 'recommendations'],
                properties: {
                  score: { type: 'number', minimum: 0, maximum: 100 },
                  recommendations: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 3,
                    items: {
                      type: 'object',
                      required: ['id', 'title'],
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        title: { type: 'string' },
                        priority: { type: 'number', minimum: 1, maximum: 5 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      // Valid input
      const validInput = {
        user: {
          name: 'John Doe',
          age: 30,
          email: 'john@example.com',
          preferences: {
            theme: 'dark',
            notifications: true,
            tags: ['important', 'urgent'],
          },
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      };

      const result = await engine.execute(
        tool,
        validInput,
        inputSchema,
        outputSchema,
      );

      // Verify the generated data matches the schema
      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('processedAt');
      expect(new Date(result.data.processedAt).toString()).not.toBe(
        'Invalid Date',
      );
      expect(result.data).toHaveProperty('result');
      expect(result.data.result).toHaveProperty('score');
      expect(typeof result.data.result.score).toBe('number');
      expect(result.data.result.score).toBeGreaterThanOrEqual(0);
      expect(result.data.result.score).toBeLessThanOrEqual(100);
      expect(result.data.result).toHaveProperty('recommendations');
      expect(Array.isArray(result.data.result.recommendations)).toBe(true);
      expect(result.data.result.recommendations.length).toBeGreaterThanOrEqual(
        1,
      );
      expect(result.data.result.recommendations.length).toBeLessThanOrEqual(3);

      // Verify each recommendation
      result.data.result.recommendations.forEach((rec: any) => {
        expect(rec).toHaveProperty('id');
        expect(rec).toHaveProperty('title');
        expect(typeof rec.id).toBe('string');
        expect(typeof rec.title).toBe('string');
        if (rec.priority) {
          expect(typeof rec.priority).toBe('number');
          expect(rec.priority).toBeGreaterThanOrEqual(1);
          expect(rec.priority).toBeLessThanOrEqual(5);
        }
      });
    });

    it('should throw error for invalid input', async () => {
      const tool = 'test-tool';
      const inputSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number', minimum: 0, maximum: 120 },
              email: { type: 'string', format: 'email' },
            },
            required: ['name', 'age', 'email'],
          },
        },
        required: ['user'],
      };

      const outputSchema = {
        type: 'object',
        properties: {
          status: { type: 'string' },
        },
        required: ['status'],
      };

      // Test cases for invalid inputs
      const invalidInputs = [
        {
          description: 'missing required field',
          input: {
            user: {
              name: 'John Doe',
              // missing age and email
            },
          },
          expectedError: 'requires property "age"',
        },
        {
          description: 'invalid type',
          input: {
            user: {
              name: 'John Doe',
              age: '30', // should be number
              email: 'john@example.com',
            },
          },
          expectedError: 'is not of a type(s) number',
        },
        {
          description: 'invalid email format',
          input: {
            user: {
              name: 'John Doe',
              age: 30,
              email: 'invalid-email', // invalid email format
            },
          },
          expectedError: 'does not conform to the "email" format',
        },
        {
          description: 'number out of range',
          input: {
            user: {
              name: 'John Doe',
              age: 150, // exceeds maximum
              email: 'john@example.com',
            },
          },
          expectedError: 'must be less than or equal to 120',
        },
        {
          description: 'missing required object',
          input: {}, // missing user object
          expectedError: 'requires property "user"',
        },
      ];

      for (const testCase of invalidInputs) {
        await expect(
          engine.execute(tool, testCase.input, inputSchema, outputSchema),
        ).rejects.toThrow(testCase.expectedError);
      }
    });

    it('should handle empty or null schemas', async () => {
      const tool = 'test-tool';
      const inputSchema = {};
      const outputSchema = {};

      const result = await engine.execute(tool, {}, inputSchema, outputSchema);
      expect(result).toEqual({});
    });

    it('should call onToolCall callback with correct parameters and use its return value', async () => {
      const tool = 'custom-tool';
      const inputData = { name: 'Test User', age: 25 };
      const inputSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };
      const outputSchema = {
        type: 'object',
        properties: {
          message: { type: 'string' },
          success: { type: 'boolean' },
        },
        required: ['message', 'success'],
      };

      // Mock callback that returns a custom result
      const mockCallback = jest.fn((toolName, input, schema) => {
        return {
          mode: 'test' as const,
          result: {
            message: `Hello ${input.name}, you are ${input.age} years old!`,
            success: true,
            customField: 'callback-generated',
          },
        };
      });

      const customEngine = new TestToolExecutionEngine(
        mockCallback,
        mockServerUrl,
        mockApiKey,
      );
      const result = await customEngine.execute(
        tool,
        inputData,
        inputSchema,
        outputSchema,
      );

      // Verify callback was called with correct parameters
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(tool, inputData, outputSchema);

      // Verify the callback's return value is used
      expect(result).toEqual({
        message: 'Hello Test User, you are 25 years old!',
        success: true,
        customField: 'callback-generated',
      });
    });

    it('should fallback to random generation when onToolCall returns test mode with null result', async () => {
      const tool = 'fallback-tool';
      const inputData = { value: 'test' };
      const inputSchema = {
        type: 'object',
        properties: {
          value: { type: 'string' },
        },
        required: ['value'],
      };
      const outputSchema = {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['success', 'error'] },
          count: { type: 'number', minimum: 1, maximum: 10 },
        },
        required: ['status', 'count'],
      };

      // Mock callback that returns null result to trigger fallback
      const mockCallback = jest.fn(() => ({
        mode: 'test' as const,
        result: null,
      }));

      const customEngine = new TestToolExecutionEngine(
        mockCallback,
        mockServerUrl,
        mockApiKey,
      );
      const result = await customEngine.execute(
        tool,
        inputData,
        inputSchema,
        outputSchema,
      );

      // Verify callback was called
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(tool, inputData, outputSchema);

      // Verify random data was generated according to schema
      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
      expect(result).toHaveProperty('count');
      expect(typeof result.count).toBe('number');
      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(result.count).toBeLessThanOrEqual(10);
    });

    it('should track call count and arguments correctly', async () => {
      const tool1 = 'tool-one';
      const tool2 = 'tool-two';
      const inputData1 = { id: 1 };
      const inputData2 = { id: 2 };
      const schema = {
        type: 'object',
        properties: { id: { type: 'number' } },
        required: ['id'],
      };

      const mockCallback = jest.fn(() => ({
        mode: 'test' as const,
        result: { result: 'mocked' },
      }));
      const customEngine = new TestToolExecutionEngine(
        mockCallback,
        mockServerUrl,
        mockApiKey,
      );

      // Execute tool1 twice
      await customEngine.execute(tool1, inputData1, schema, schema);
      await customEngine.execute(tool1, { id: 3 }, schema, schema);

      // Execute tool2 once
      await customEngine.execute(tool2, inputData2, schema, schema);

      // Verify call counts
      expect(customEngine.getCallCount(tool1)).toBe(2);
      expect(customEngine.getCallCount(tool2)).toBe(1);
      expect(customEngine.getCallCount('non-existent')).toBe(0);

      // Verify call arguments (should store the last call's arguments)
      expect(customEngine.getCallArgs(tool1)).toEqual({ id: 3 });
      expect(customEngine.getCallArgs(tool2)).toEqual(inputData2);
      expect(customEngine.getCallArgs('non-existent')).toBeNull();
    });

    describe('real mode execution', () => {
      it('should delegate to real implementation when mode is real', async () => {
        const tool = 'real-tool';
        const inputData = { param: 'value' };
        const inputSchema = {
          type: 'object',
          properties: { param: { type: 'string' } },
          required: ['param'],
        };
        const outputSchema = {
          type: 'object',
          properties: { result: { type: 'string' } },
          required: ['result'],
        };
        const expectedOutput = { result: 'real execution result' };

        // Mock the HTTP request that the real implementation would make
        nock(mockServerUrl)
          .post('/tool/real-tool/use')
          .matchHeader('x-api-key', mockApiKey)
          .reply(200, { output: expectedOutput });

        // Mock callback that returns real mode
        const mockCallback = jest.fn(() => ({ mode: 'real' as const }));

        const customEngine = new TestToolExecutionEngine(
          mockCallback,
          mockServerUrl,
          mockApiKey,
        );

        const result = await customEngine.execute(
          tool,
          inputData,
          inputSchema,
          outputSchema,
        );

        // Verify callback was called
        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback).toHaveBeenCalledWith(
          tool,
          inputData,
          outputSchema,
        );

        // Verify the real implementation was used (should return the mocked HTTP response)
        expect(result).toEqual(expectedOutput);

        // Verify the HTTP request was made
        expect(nock.isDone()).toBe(true);
      });

      it('should handle real mode execution errors', async () => {
        const tool = 'failing-real-tool';
        const inputData = { param: 'value' };
        const inputSchema = {
          type: 'object',
          properties: { param: { type: 'string' } },
          required: ['param'],
        };
        const outputSchema = {
          type: 'object',
          properties: { result: { type: 'string' } },
          required: ['result'],
        };

        // Mock server error response
        nock(mockServerUrl)
          .post('/tool/failing-real-tool/use')
          .reply(500, { error: 'Internal Server Error' });

        // Mock callback that returns real mode
        const mockCallback = jest.fn(() => ({ mode: 'real' as const }));

        const customEngine = new TestToolExecutionEngine(
          mockCallback,
          mockServerUrl,
          mockApiKey,
        );

        await expect(
          customEngine.execute(tool, inputData, inputSchema, outputSchema),
        ).rejects.toThrow('Failed to execute tool');

        // Verify callback was called
        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback).toHaveBeenCalledWith(
          tool,
          inputData,
          outputSchema,
        );

        // Verify the HTTP request was made
        expect(nock.isDone()).toBe(true);
      });

      it('should handle real mode with network errors', async () => {
        const tool = 'network-fail-tool';
        const inputData = { param: 'value' };
        const inputSchema = {
          type: 'object',
          properties: { param: { type: 'string' } },
          required: ['param'],
        };
        const outputSchema = {
          type: 'object',
          properties: { result: { type: 'string' } },
          required: ['result'],
        };

        // Mock network error
        nock(mockServerUrl)
          .post('/tool/network-fail-tool/use')
          .replyWithError('Network error');

        // Mock callback that returns real mode
        const mockCallback = jest.fn(() => ({ mode: 'real' as const }));

        const customEngine = new TestToolExecutionEngine(
          mockCallback,
          mockServerUrl,
          mockApiKey,
        );

        await expect(
          customEngine.execute(tool, inputData, inputSchema, outputSchema),
        ).rejects.toThrow('Network error');

        // Verify callback was called
        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback).toHaveBeenCalledWith(
          tool,
          inputData,
          outputSchema,
        );

        // Verify the HTTP request was made
        expect(nock.isDone()).toBe(true);
      });
    });
  });
});
