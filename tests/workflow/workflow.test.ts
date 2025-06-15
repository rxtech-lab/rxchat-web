import { createJSExecutionEngine } from '@/lib/workflow/engine';
import { createTestToolExecutionEngine } from '@/lib/workflow/engine/testToolExecutionEngine';
import { WorkflowReferenceError } from '@/lib/workflow/errors';
import type { ConverterNode, FixedInput, ToolNode } from '@/lib/workflow/types';
import { WorkflowEngine } from '@/lib/workflow/workflow-engine';
import { expect, test } from '@playwright/test';
import { v4 } from 'uuid';

test.describe('workflow', () => {
  test('should be able to create a simple btc price alert workflow', async () => {
    const workflow = {
      trigger: {
        type: 'cronjob-trigger',
        identifier: 'cronjob-trigger',
        cron: '0 0 * * *',
        child: {
          type: 'fixed-input',
          identifier: v4(),
          output: {
            symbol: 'BTCUSDT',
          },
          child: {
            type: 'tool',
            toolIdentifier: 'binance',
            identifier: v4(),
            inputSchema: {},
            outputSchema: {},
            child: {
              type: 'converter',
              identifier: v4(),
              runtime: 'js',
              code: `
                async function handle(input) {
                  return {
                    message: \`BTCUSDT price is \${input.price}\`,
                  };
                }
              `,
              child: {
                type: 'fixed-input',
                identifier: v4(),
                output: {
                  chat_id: '{{context.tgId}}',
                  message: '{{input.message}}',
                },
                child: {
                  type: 'tool',
                  toolIdentifier: 'telegram-bot',
                  identifier: v4(),
                  inputSchema: {},
                  outputSchema: {},
                } as ToolNode,
              } as FixedInput,
            } as ConverterNode,
          } as ToolNode,
        } as FixedInput,
      },
      title: 'BTC Price Alert',
    };

    const testToolExecutionEngine = createTestToolExecutionEngine((tool) => {
      if (tool === 'telegram-bot') {
        return {
          mode: 'test',
          result: {
            result: 'success',
          },
        };
      }
      return {
        mode: 'real',
      };
    });
    const workflowEngine = new WorkflowEngine(
      createJSExecutionEngine(),
      testToolExecutionEngine,
    );

    await workflowEngine.execute(workflow as any, {
      tgId: '1234567890',
    });
    // expect testToolTelegram > 1
    expect(
      testToolExecutionEngine.getCallCount('telegram-bot'),
    ).toBeGreaterThan(0);

    const args = testToolExecutionEngine.getCallArgs('telegram-bot');
    expect(args.chat_id).toBe('1234567890');
    expect(args.message).not.toBe('BTCUSDT price is undefined');
  });

  test('should be able to run a workflow', async () => {
    const workflow = {
      title: 'New Workflow',
      trigger: {
        type: 'cronjob-trigger',
        identifier: 'ca80b89f-743a-402d-b604-dbcc9079a477',
        cron: '*/10 * * * *',
        child: {
          identifier: '265da7c0-3b7d-4a24-ae80-31942ccfffef',
          type: 'fixed-input',
          output: {
            symbol: 'BTCUSDT',
          },
          child: {
            identifier: 'd5df14db-cd6c-4fb7-bda7-c3d6e9693b58',
            type: 'tool',
            toolIdentifier: 'binance',
            child: {
              identifier: '4b7603bc-44fe-41ea-b96f-a6cfdf5d826d',
              type: 'converter',
              code: 'async function handle(input) { return { message: `BTCUSDT price is ${input.price}` }; }',
              child: {
                identifier: 'f461d1b3-ed2a-40e3-826e-2e581da3dd5a',
                type: 'fixed-input',
                output: {
                  chat_id: '{{context.telegramId}}',
                  message: '{{input.message}}',
                },
                child: {
                  identifier: '26ed6832-b7b0-4885-937b-4a8c4618090d',
                  type: 'tool',
                  toolIdentifier: 'telegram-bot',
                  child: null,
                  description:
                    '\n\t\tTelegram Bot is a tool that allows you to send messages to Telegram chats.\n\t\tYou can use this tool to send messages in Markdown format to any chat where the bot has access.\n\t\t',
                  inputSchema: {},
                  outputSchema: {},
                },
              },
              runtime: 'js',
            },
            description: 'Access cryptocurrency price data via Binance API',
            inputSchema: {},
          },
        },
      },
    } as any;

    const testToolExecutionEngine = createTestToolExecutionEngine((tool) => {
      if (tool === 'telegram-bot') {
        return {
          mode: 'test',
          result: {
            result: 'success',
          },
        };
      }
      return {
        mode: 'real',
      };
    });
    const workflowEngine = new WorkflowEngine(
      createJSExecutionEngine(),
      testToolExecutionEngine,
    );

    await workflowEngine.execute(workflow, {
      telegramId: '1234567890',
    });
    // expect testToolTelegram > 1
    expect(
      testToolExecutionEngine.getCallCount('telegram-bot'),
    ).toBeGreaterThan(0);

    const args = testToolExecutionEngine.getCallArgs('telegram-bot');
    expect(args.chat_id).toBe('1234567890');
    expect(args.message).not.toBe('BTCUSDT price is undefined');
  });

  test('should be able to throw error if referencing a non existing context', async () => {
    const workflow = {
      title: 'New Workflow',
      trigger: {
        type: 'cronjob-trigger',
        identifier: 'ca80b89f-743a-402d-b604-dbcc9079a477',
        cron: '*/10 * * * *',
        child: {
          identifier: '265da7c0-3b7d-4a24-ae80-31942ccfffef',
          type: 'fixed-input',
          output: {
            symbol: 'BTCUSDT',
          },
          child: {
            identifier: 'd5df14db-cd6c-4fb7-bda7-c3d6e9693b58',
            type: 'tool',
            toolIdentifier: 'binance',
            child: {
              identifier: '4b7603bc-44fe-41ea-b96f-a6cfdf5d826d',
              type: 'converter',
              code: 'async function handle(input) { return { message: `BTCUSDT price is ${input.price}` }; }',
              child: {
                identifier: 'f461d1b3-ed2a-40e3-826e-2e581da3dd5a',
                type: 'fixed-input',
                output: {
                  chat_id: '{{context.telegramId}}',
                  message: '{{input.message}}',
                },
                child: {
                  identifier: '26ed6832-b7b0-4885-937b-4a8c4618090d',
                  type: 'tool',
                  toolIdentifier: 'telegram-bot',
                  child: null,
                  description:
                    '\n\t\tTelegram Bot is a tool that allows you to send messages to Telegram chats.\n\t\tYou can use this tool to send messages in Markdown format to any chat where the bot has access.\n\t\t',
                  inputSchema: {},
                  outputSchema: {},
                },
              },
              runtime: 'js',
            },
            description: 'Access cryptocurrency price data via Binance API',
            inputSchema: {},
          },
        },
      },
    } as any;

    const testToolExecutionEngine = createTestToolExecutionEngine((tool) => {
      if (tool === 'telegram-bot') {
        return {
          mode: 'test',
          result: {
            result: 'success',
          },
        };
      }
      return {
        mode: 'real',
      };
    });
    const workflowEngine = new WorkflowEngine(
      createJSExecutionEngine(),
      testToolExecutionEngine,
    );

    expect(() =>
      workflowEngine.execute(workflow, {
        telegramId: null,
      }),
    ).rejects.toThrow(new WorkflowReferenceError('context', 'telegramId'));
  });
});
