import { TestToolExecutionEngine } from './testToolExecutionEngine';

describe('TestToolExecutionEngine', () => {
  let engine: TestToolExecutionEngine;

  beforeEach(() => {
    engine = new TestToolExecutionEngine();
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

      // Verify the result structure
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('tool', tool);
      expect(result.metadata).toHaveProperty('isTestExecution', true);
      expect(result.metadata).toHaveProperty('timestamp');

      // Verify the generated data matches the schema
      expect(result.result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.result.status);
      expect(result.result).toHaveProperty('data');
      expect(result.result.data).toHaveProperty('processedAt');
      expect(new Date(result.result.data.processedAt).toString()).not.toBe(
        'Invalid Date',
      );
      expect(result.result.data).toHaveProperty('result');
      expect(result.result.data.result).toHaveProperty('score');
      expect(typeof result.result.data.result.score).toBe('number');
      expect(result.result.data.result.score).toBeGreaterThanOrEqual(0);
      expect(result.result.data.result.score).toBeLessThanOrEqual(100);
      expect(result.result.data.result).toHaveProperty('recommendations');
      expect(Array.isArray(result.result.data.result.recommendations)).toBe(
        true,
      );
      expect(
        result.result.data.result.recommendations.length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        result.result.data.result.recommendations.length,
      ).toBeLessThanOrEqual(3);

      // Verify each recommendation
      result.result.data.result.recommendations.forEach((rec: any) => {
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
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('tool', tool);
      expect(result.metadata).toHaveProperty('isTestExecution', true);
    });
  });
});
