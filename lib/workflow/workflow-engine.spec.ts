import { v4 } from 'uuid';
import type {
  ConditionNode,
  ConverterNode,
  FixedInput,
  ToolNode,
  Workflow,
} from './types';
import {
  type JSCodeExecutionEngine,
  type ToolExecutionEngine,
  WorkflowEngine,
} from './workflow-engine';
import { WorkflowReferenceError } from './errors';
import {
  createTestToolExecutionEngine,
  TestToolExecutionEngine,
} from './engine/testToolExecutionEngine';
import { createJSExecutionEngine } from './engine';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let jsCodeExecutionEngine: JSCodeExecutionEngine;
  let toolExecutionEngine: ToolExecutionEngine;

  beforeEach(() => {
    jsCodeExecutionEngine = {
      execute: jest.fn(),
    };
    toolExecutionEngine = {
      execute: jest.fn(),
    };
    engine = new WorkflowEngine(jsCodeExecutionEngine, toolExecutionEngine);
  });

  describe('Basic Workflow Execution', () => {
    it('should throw error if workflow with just a trigger', async () => {
      const workflow: Workflow = {
        title: 'Simple Trigger Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: null,
        },
      };

      // Should not throw any errors
      await expect(engine.execute(workflow)).rejects.toThrow();
    });

    it('Should be able to execute a workflow with condition node', async () => {
      const node1: ToolNode = {
        identifier: 'node1',
        type: 'tool',
        toolIdentifier: 'tool1',
        description: 'Test tool 1',
      };

      const node2: ToolNode = {
        identifier: 'node2',
        type: 'tool',
        toolIdentifier: 'tool2',
        description: 'Test tool 2',
      };

      const conditionNode: ConditionNode = {
        identifier: 'condition',
        type: 'condition',
        code: 'return "node1";',
        children: [node1, node2],
        runtime: 'js',
      };

      const workflow: Workflow = {
        title: 'Condition Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: conditionNode,
        },
      };

      // mock the jsCodeExecutionEngine to return "node1"
      jsCodeExecutionEngine.execute = jest.fn().mockReturnValue('node1');

      // mock the toolExecutionEngine to return "tool1"
      toolExecutionEngine.execute = jest.fn().mockReturnValue('tool1');

      await expect(engine.execute(workflow)).resolves.not.toThrow();
      // toolExecutionEngine should be called 1 time
      expect(toolExecutionEngine.execute).toHaveBeenCalledTimes(1);
      // jsCodeExecutionEngine should be called 1 time
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledTimes(1);

      // expect input to be "tool1"
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledWith(
        null,
        'return "node1";',
        { nodeId: 'condition' },
      );
    });

    it('Should be able to execute a workflow with condition node in the middle', async () => {
      const node2: ToolNode = {
        identifier: 'node2',
        type: 'tool',
        toolIdentifier: 'tool2',
        description: 'Test tool 2',
      };

      const conditionNode: ConditionNode = {
        identifier: 'condition',
        type: 'condition',
        code: 'return "node1";',
        children: [node2],
        runtime: 'js',
      };

      const node1: ToolNode = {
        identifier: 'node1',
        type: 'tool',
        toolIdentifier: 'tool1',
        child: conditionNode,
        description: 'Test tool 1',
      };

      const workflow: Workflow = {
        title: 'Condition Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: node1,
        },
      };

      // mock the jsCodeExecutionEngine to return "node1"
      jsCodeExecutionEngine.execute = jest.fn().mockReturnValue('node1');

      // mock the toolExecutionEngine to return "tool1"
      toolExecutionEngine.execute = jest.fn().mockReturnValue('tool1');

      await expect(engine.execute(workflow)).resolves.not.toThrow();
      // toolExecutionEngine should be called 1 time
      expect(toolExecutionEngine.execute).toHaveBeenCalledTimes(1);
      // jsCodeExecutionEngine should be called 1 time
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledTimes(1);

      // expect input to be "tool1"
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledWith(
        {
          input: 'tool1',
          nodeId: 'node1',
        },
        'return "node1";',
        { nodeId: 'condition' },
      );
    });

    it('Should be able to execute a workflow with converter node', async () => {
      const converterNode: ConverterNode = {
        identifier: 'converter',
        type: 'converter',
        code: 'return "tool1";',
        runtime: 'js',
      };

      const node1: ToolNode = {
        identifier: 'node1',
        type: 'tool',
        toolIdentifier: 'tool1',
        description: 'Test tool 1',
      };

      const node2: ToolNode = {
        identifier: 'node2',
        type: 'tool',
        toolIdentifier: 'tool2',
        description: 'Test tool 2',
      };

      node1.child = converterNode;
      converterNode.child = node2;

      const workflow: Workflow = {
        title: 'Condition Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: node1,
        },
      };

      // mock the jsCodeExecutionEngine to return "node1"
      jsCodeExecutionEngine.execute = jest.fn().mockReturnValue('string');

      // mock the toolExecutionEngine to return "tool1"
      toolExecutionEngine.execute = jest.fn().mockReturnValue('tools');

      await expect(engine.execute(workflow)).resolves.not.toThrow();
      // toolExecutionEngine should be called 1 time
      expect(toolExecutionEngine.execute).toHaveBeenCalledTimes(2);
      // jsCodeExecutionEngine should be called 1 time
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledTimes(1);

      // expect input to be "tools"
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledWith(
        'tools',
        'return "tool1";',
        {
          input: 'tools',
          code: 'return "tool1";',
          nodeId: 'converter',
        },
      );
    });
  });

  describe('Fixed Input', () => {
    it('Should be able to execute a workflow with fixed input', async () => {
      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: v4(),
        output: { fullName: '{{input.firstName}} {{context.lastName}}' },
        child: null,
      };

      const workflow: Workflow = {
        title: 'Fixed Input Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      await expect(
        engine.execute(workflow, {
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).resolves.toStrictEqual({
        fullName: 'John Doe',
      });
    });

    it('Should be able to execute a workflow with fixed input with nested object', async () => {
      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: v4(),
        output: { name: { full: '{{input.firstName}} {{context.lastName}}' } },
        child: null,
      };

      const workflow: Workflow = {
        title: 'Fixed Input Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      await expect(
        engine.execute(workflow, {
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).resolves.toStrictEqual({
        name: {
          full: 'John Doe',
        },
      });
    });

    it('Should be able pass fixed input output to next input', async () => {
      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: v4(),
        output: { fullName: '{{input.firstName}} {{context.lastName}}' },
        child: {
          identifier: v4(),
          type: 'fixed-input',
          output: {
            fullName: '{{input.fullName}}',
          },
          child: null,
        } as FixedInput, // Assuming the next node is a ToolNode
      };

      const workflow: Workflow = {
        title: 'Fixed Input Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      await expect(
        engine.execute(workflow, {
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).resolves.toStrictEqual({
        fullName: 'John Doe',
      });
    });
  });

  describe('FixedInput to ToolNode Integration', () => {
    it('Should pass FixedInput output to ToolNode as input', async () => {
      const toolNode: ToolNode = {
        identifier: 'tool-node',
        type: 'tool',
        toolIdentifier: 'test-tool',
        description: 'Test tool that receives fixed input output',
        child: null,
      };

      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: 'fixed-input-node',
        output: {
          processedData: '{{input.userName}} is {{input.age}} years old',
          userInfo: {
            name: '{{input.userName}}',
            age: '{{input.age}}',
            context: '{{context.environment}}',
          },
        },
        child: toolNode,
      };

      const workflow: Workflow = {
        title: 'FixedInput to ToolNode Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      // Mock the toolExecutionEngine to return some result
      const mockToolResult = {
        success: true,
        result: 'Tool executed successfully',
      };
      toolExecutionEngine.execute = jest.fn().mockReturnValue(mockToolResult);

      // Execute the workflow with context
      const result = await engine.execute(workflow, {
        userName: 'Alice',
        age: 30,
        environment: 'production',
      });

      // Verify that toolExecutionEngine was called
      expect(toolExecutionEngine.execute).toHaveBeenCalledTimes(1);

      // Verify that the tool received the processed output from FixedInput
      expect(toolExecutionEngine.execute).toHaveBeenCalledWith(
        'test-tool',
        {
          processedData: 'Alice is 30 years old',
          userInfo: {
            name: 'Alice',
            age: '30',
            context: 'production',
          },
        },
        undefined,
        undefined,
      );

      // Verify the final result is from the tool
      expect(result).toEqual(mockToolResult);
    });

    it('Should pass data through FixedInput → ToolNode → ConverterNode sequence', async () => {
      const converterNode: ConverterNode = {
        identifier: 'converter-node',
        type: 'converter',
        code: 'return { convertedResult: `Processed: ${input.result}`, originalSuccess: input.success };',
        runtime: 'js',
        child: null,
      };

      const toolNode: ToolNode = {
        identifier: 'tool-node',
        type: 'tool',
        toolIdentifier: 'data-processor',
        description: 'Tool that processes fixed input data',
        child: converterNode,
      };

      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: 'fixed-input-node',
        output: {
          processType: '{{input.category}}_processing',
          itemCount: '{{input.count}}',
          environment: '{{context.env}}',
        },
        child: toolNode,
      };

      const workflow: Workflow = {
        title: 'FixedInput → ToolNode → ConverterNode Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      // Mock the toolExecutionEngine to return processed data
      const mockToolResult = {
        success: true,
        result: 'users_processing completed with 42 items in staging',
      };
      toolExecutionEngine.execute = jest.fn().mockReturnValue(mockToolResult);

      // Mock the jsCodeExecutionEngine for the converter
      const mockConverterResult = {
        convertedResult:
          'Processed: users_processing completed with 42 items in staging',
        originalSuccess: true,
      };
      jsCodeExecutionEngine.execute = jest
        .fn()
        .mockReturnValue(mockConverterResult);

      // Execute the workflow with context
      const result = await engine.execute(workflow, {
        category: 'users',
        count: 42,
        env: 'staging',
      });

      // Verify that toolExecutionEngine was called with FixedInput output
      expect(toolExecutionEngine.execute).toHaveBeenCalledTimes(1);
      expect(toolExecutionEngine.execute).toHaveBeenCalledWith(
        'data-processor',
        {
          processType: 'users_processing',
          itemCount: '42',
          environment: 'staging',
        },
        undefined,
        undefined,
      );

      // Verify that jsCodeExecutionEngine was called with ToolNode output
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledTimes(1);
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledWith(
        mockToolResult,
        'return { convertedResult: `Processed: ${input.result}`, originalSuccess: input.success };',
        {
          input: mockToolResult,
          code: 'return { convertedResult: `Processed: ${input.result}`, originalSuccess: input.success };',
          nodeId: 'converter-node',
        },
      );

      // Verify the final result is from the converter
      expect(result).toEqual(mockConverterResult);
    });

    it('Should throw error if output refer to non existing context or input', async () => {
      const toolNode: ToolNode = {
        identifier: 'tool-node',
        type: 'tool',
        toolIdentifier: 'test-tool',
        description: 'Test tool that receives fixed input output',
        child: null,
      };

      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: 'fixed-input-node',
        output: {
          userInfo: {
            name: '{{input.nonExistingInput}}',
            context: '{{context.nonExistingContext}}',
          },
        },
        child: toolNode,
      };

      const workflow: Workflow = {
        title: 'FixedInput to ToolNode Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      // Execute the workflow with context that doesn't match the referenced variables
      await expect(
        engine.execute(workflow, {
          // Intentionally not providing nonExistingInput
          someOtherInput: 'value',
          // Intentionally not providing nonExistingContext
          someOtherContext: 'value',
        }),
      ).rejects.toThrow(
        new WorkflowReferenceError('input', 'nonExistingInput'),
      );
    });

    it('Should throw error if output refer to non existing context', async () => {
      const toolNode: ToolNode = {
        identifier: 'tool-node',
        type: 'tool',
        toolIdentifier: 'test-tool',
        description: 'Test tool that receives fixed input output',
        child: null,
      };

      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: 'fixed-input-node',
        output: {
          userInfo: {
            context: '{{context.nonExistingContext}}',
          },
        },
        child: toolNode,
      };

      const workflow: Workflow = {
        title: 'FixedInput to ToolNode Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      await expect(
        engine.execute(workflow, {
          // No nonExistingContext provided
          someOtherContext: 'value',
        }),
      ).rejects.toThrow(
        new WorkflowReferenceError('context', 'nonExistingContext'),
      );
    });
  });

  describe('FixedInput to ConverterNode Integration', () => {
    beforeEach(() => {
      process.env.MCP_ROUTER_SERVER_URL = 'http://localhost:3000';
      process.env.MCP_ROUTER_SERVER_API_KEY = 'test-api-key';
    });
    it('Should be able to pass FixedInput output to ConverterNode', async () => {
      const converterNode: ConverterNode = {
        identifier: 'fd55a028-6db0-45d9-b1d7-00859e38363e',
        type: 'converter',
        code: 'async function handle(input) {\n  return {\n    "message": `BTCUSDT price: ${input.price.price}`,\n    "chat_id": 12345\n  }\n}',
        child: null,
        runtime: 'js',
      };

      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: '2802be26-8827-4625-8529-ac363c0cb5fd',
        output: {
          endpoint: 'PRICE',
          price: {
            symbol: 'BTCUSDT',
          },
        },
        child: converterNode,
      };

      const workflow: Workflow = {
        title: 'FixedInput to ConverterNode Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      const engine = new WorkflowEngine(
        createJSExecutionEngine(),
        createTestToolExecutionEngine(),
      );

      const result = await engine.execute(workflow);
      expect(result).toEqual({
        message: 'BTCUSDT price: undefined',
        chat_id: 12345,
      });
    });

    it('Should be able to pass converter output to fixed input', async () => {
      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: '2802be26-8827-4625-8529-ac363c0cb5fd',
        output: {
          message: '{{input}}',
        },
        child: null,
      };
      const converterNode: ConverterNode = {
        identifier: 'fd55a028-6db0-45d9-b1d7-00859e38363e',
        type: 'converter',
        code: 'async function handle(input) {\n  return "hello world"; \n}',
        child: fixedInput,
        runtime: 'js',
      };

      const workflow: Workflow = {
        title: 'FixedInput to ConverterNode Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: converterNode,
        },
      };

      const engine = new WorkflowEngine(
        createJSExecutionEngine(),
        createTestToolExecutionEngine(),
      );

      const result = await engine.execute(workflow);
      expect(result).toEqual({
        message: 'hello world',
      });
    });
  });
});

describe('Workflow Engine with test ToolExecutionEngine', () => {
  let engine: WorkflowEngine;
  let jsCodeExecutionEngine: JSCodeExecutionEngine;
  let toolExecutionEngine: TestToolExecutionEngine;

  beforeEach(() => {
    process.env.MCP_ROUTER_SERVER_URL = 'http://localhost:3000';
    process.env.MCP_ROUTER_SERVER_API_KEY = 'test-api-key';
    jsCodeExecutionEngine = {
      execute: jest.fn(),
    };
    toolExecutionEngine = new TestToolExecutionEngine();
    engine = new WorkflowEngine(jsCodeExecutionEngine, toolExecutionEngine);
  });

  describe('Fixed Input', () => {
    it('Should be able to execute a workflow with fixed input', async () => {
      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: v4(),
        output: { fullName: '{{input.firstName}} {{context.lastName}}' },
        child: null,
      };

      const workflow: Workflow = {
        title: 'Fixed Input Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      await expect(
        engine.execute(workflow, {
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).resolves.toStrictEqual({
        fullName: 'John Doe',
      });
    });

    it('Should be able to execute a workflow with fixed input with nested object', async () => {
      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: v4(),
        output: { name: { full: '{{input.firstName}} {{context.lastName}}' } },
        child: null,
      };

      const workflow: Workflow = {
        title: 'Fixed Input Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      await expect(
        engine.execute(workflow, {
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).resolves.toStrictEqual({
        name: {
          full: 'John Doe',
        },
      });
    });

    it('Should be able pass fixed input output to next input', async () => {
      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: v4(),
        output: { fullName: '{{input.firstName}} {{context.lastName}}' },
        child: {
          identifier: v4(),
          type: 'fixed-input',
          output: {
            fullName: '{{input.fullName}}',
          },
          child: null,
        } as FixedInput, // Assuming the next node is a ToolNode
      };

      const workflow: Workflow = {
        title: 'Fixed Input Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      await expect(
        engine.execute(workflow, {
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).resolves.toStrictEqual({
        fullName: 'John Doe',
      });
    });
  });

  describe('real workflow', () => {
    it('should be able to execute a real notification workflow with converter node', async () => {
      const workflow = {
        title: 'New Workflow',
        trigger: {
          type: 'cronjob-trigger',
          identifier: '2802be26-8827-4625-8529-ac363c0cb5fd',
          cron: '*/10 * * * *',
          child: {
            identifier: '0acaea6e-eb30-476d-8198-4e128afc2500',
            type: 'fixed-input',
            output: {
              endpoint: 'PRICE',
              price: {
                symbol: 'BTCUSDT',
              },
            },
            child: {
              identifier: '66ebe3cc-f5cc-4acd-a559-9cce11248d9c',
              type: 'tool',
              toolIdentifier: 'binance',
              child: {
                identifier: 'fd55a028-6db0-45d9-b1d7-00859e38363e',
                type: 'converter',
                code: 'async function handle(input) {\n  return `BTCUSDT price: ${input.price}`;\n}',
                runtime: 'js',
                child: {
                  type: 'fixed-input',
                  identifier: v4(),
                  output: {
                    message: '{{input}}',
                    chat_id: '{{context.telegramChatId}}',
                    child: {
                      identifier: 'b8c33ba5-5255-4e1d-9892-f92ab8d28a08',
                      type: 'tool',
                      toolIdentifier: 'telegram-bot',
                      child: null,
                      description:
                        '\n\t\tTelegram Bot is a tool that allows you to send messages to Telegram chats.\n\t\tYou can use this tool to send messages in Markdown format to any chat where the bot has access.\n\t\t',
                      inputSchema: {
                        $id: 'https://github.com/wyt-labs/mcp-router/plugins/telegram-bot/telegram/send-message-input',
                        $schema: 'https://json-schema.org/draft/2020-12/schema',
                        additionalProperties: false,
                        properties: {
                          chat_id: {
                            description: 'Chat ID',
                            type: 'integer',
                          },
                          message: {
                            description: 'Message text in markdown format',
                            type: 'string',
                          },
                        },
                        required: ['message', 'chat_id'],
                        type: 'object',
                      },
                      outputSchema: {
                        $id: 'https://github.com/wyt-labs/mcp-router/plugins/telegram-bot/telegram/send-message-output',
                        $schema: 'https://json-schema.org/draft/2020-12/schema',
                        additionalProperties: false,
                        properties: {
                          error: {
                            description: 'Error message if the request failed',
                            type: 'string',
                          },
                        },
                        type: 'object',
                      },
                    },
                  },
                } as FixedInput,
              },
              description: 'Access cryptocurrency price data via Binance API',
              inputSchema: {
                $schema: 'https://json-schema.org/draft/2020-12/schema',
                additionalProperties: false,
                properties: {
                  endpoint: {
                    enum: ['TICKER_24HR', 'PRICE'],
                    type: 'string',
                  },
                  headers: {
                    additionalProperties: {
                      type: 'string',
                    },
                    description: 'Custom headers for the HTTP request',
                    type: 'object',
                  },
                  price: {
                    additionalProperties: false,
                    description: 'Input for PRICE endpoint',
                    properties: {
                      symbol: {
                        description: 'Trading pair symbol (e.g.',
                        type: 'string',
                      },
                    },
                    type: 'object',
                  },
                  ticker_24hr: {
                    additionalProperties: false,
                    description: 'Input for TICKER_24HR endpoint',
                    properties: {
                      symbol: {
                        description: 'Trading pair symbol (e.g.',
                        type: 'string',
                      },
                    },
                    type: 'object',
                  },
                },
                required: ['endpoint'],
                type: 'object',
              },
              outputSchema: {
                $schema: 'https://json-schema.org/draft/2020-12/schema',
                additionalProperties: false,
                properties: {
                  data: {
                    description: 'Response data from Binance API',
                    type: 'object',
                    properties: {
                      price: {
                        type: 'string',
                        description: 'Current price of the trading pair',
                      },
                    },
                  },
                  error: {
                    description: 'Error message if the request failed',
                    type: 'string',
                  },
                },
                required: ['data'],
                type: 'object',
              },
            },
          },
        },
      };

      const engine = new WorkflowEngine(
        createJSExecutionEngine(),
        toolExecutionEngine,
      );

      await engine.execute(workflow as any, {
        telegramChatId: 12345,
      });
      expect(toolExecutionEngine);
    });
  });
});
