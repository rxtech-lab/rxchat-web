import * as jsonschema from 'jsonschema';
import { faker } from '@faker-js/faker';
import { McpToolExecutionEngine } from './toolExecutionEngine';

export type ToolCallResult =
  | {
      mode: 'real';
    }
  | {
      mode: 'test';
      result: Record<string, any> | null;
    };

/**
 * Generate a mock tool call result. If return null, will use the random output schema to generate a random output.
 */
export type OnToolCall = (
  tool: string,
  input: Record<string, any>,
  outputSchema: Record<string, any>,
) => ToolCallResult;

/**
 * Fake tool execution engine that use for testing the workflow without real tool execution
 */
export class TestToolExecutionEngine extends McpToolExecutionEngine {
  private validator: jsonschema.Validator;
  private callCountMap: Record<string, number> = {};
  private callArgsMap: Record<string, any> = {};

  constructor(
    private readonly onToolCall: OnToolCall | null = null,
    mcpRouterServerUrl?: string,
    mcpRouterApiKey?: string,
  ) {
    super(mcpRouterServerUrl, mcpRouterApiKey);
    this.validator = new jsonschema.Validator();
  }

  public getCallCount(tool: string): number {
    return this.callCountMap[tool] || 0;
  }

  public getCallArgs(tool: string): any {
    return this.callArgsMap[tool] || null;
  }

  /**
   * Generate random data based on JSON Schema
   * @param schema The JSON Schema to generate data for
   * @returns Random data that matches the schema
   */
  private generateRandomData(schema: Record<string, any>): any {
    if (!schema || typeof schema !== 'object') {
      return null;
    }

    const type = schema.type;

    switch (type) {
      case 'string': {
        if (schema.enum) {
          return faker.helpers.arrayElement(schema.enum);
        }
        if (schema.format === 'email') {
          return faker.internet.email();
        }
        if (schema.format === 'date-time') {
          return faker.date.anytime().toISOString();
        }
        if (schema.format === 'uuid') {
          return faker.string.uuid();
        }
        return faker.lorem.sentence();
      }

      case 'number':
      case 'integer': {
        const min = schema.minimum ?? 0;
        const max = schema.maximum ?? 100;
        return faker.number.int({ min, max });
      }

      case 'boolean': {
        return faker.datatype.boolean();
      }

      case 'array': {
        const minItems = schema.minItems ?? 1;
        const maxItems = schema.maxItems ?? 5;
        const length = faker.number.int({ min: minItems, max: maxItems });
        const items = schema.items;
        return Array.from({ length }, () => this.generateRandomData(items));
      }

      case 'object': {
        if (!schema.properties) {
          return {};
        }
        const result: Record<string, any> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (schema.required?.includes(key)) {
            result[key] = this.generateRandomData(
              propSchema as Record<string, any>,
            );
          } else if (faker.datatype.boolean()) {
            // Randomly include optional properties
            result[key] = this.generateRandomData(
              propSchema as Record<string, any>,
            );
          }
        }
        return result;
      }

      default:
        return null;
    }
  }

  /**
   * Execute the tool. This function will first check whether the input matches the input schema using `jsonschema`.
   * If onToolCall returns mode 'real', it will delegate to the real McpToolExecutionEngine.
   * If onToolCall returns mode 'test', it will use the provided result or generate random data.
   */
  async execute(
    tool: string,
    input: any,
    inputSchema: Record<string, any>,
    outputSchema: Record<string, any>,
  ): Promise<any> {
    // Validate input against input schema
    const validationResult = this.validator.validate(input, inputSchema);
    this.callCountMap[tool] = (this.callCountMap[tool] || 0) + 1;
    this.callArgsMap[tool] = input;

    if (!validationResult.valid) {
      throw new Error(
        `Input validation failed for tool ${tool}: ${validationResult.errors
          .map((e) => e.message)
          .join(', ')}`,
      );
    }

    // Get the tool call result from the callback
    const toolCallResult = this.onToolCall?.(tool, input, outputSchema);

    if (toolCallResult?.mode === 'real') {
      // Delegate to the real implementation
      return await super.execute(tool, input, inputSchema, outputSchema);
    }

    // Handle test mode
    let result: any;
    if (toolCallResult?.result !== null) {
      result = toolCallResult?.result;
    } else {
      // Generate random output based on output schema
      result = this.generateRandomData(outputSchema);
    }

    // Add a small delay to simulate real tool execution
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      result,
      metadata: {
        tool,
        timestamp: new Date().toISOString(),
        isTestExecution: true,
      },
    };
  }
}

export const createTestToolExecutionEngine = (
  onToolCall: OnToolCall = () => ({ mode: 'test', result: null }),
  mcpRouterServerUrl?: string,
  mcpRouterApiKey?: string,
): TestToolExecutionEngine => {
  return new TestToolExecutionEngine(
    onToolCall,
    mcpRouterServerUrl,
    mcpRouterApiKey,
  );
};
