import { test, expect } from '@playwright/test';
import type {
  ConverterNode,
  FixedInput,
  ToolNode,
  Workflow,
} from '@/lib/workflow/types';
import { v4 } from 'uuid';
import { WorkflowEngine } from '@/lib/workflow/workflow-engine';
import {
  createJSExecutionEngine,
  createToolExecutionEngine,
} from '@/lib/workflow/engine';

const code = `

async function handle(input: any) {
  return input;
}
`;

test.describe('Workflow execution', () => {
  test('should execute a workflow', async ({ page }) => {
    const workflow = {
      title: 'Test Workflow',
      trigger: {
        type: 'cronjob-trigger',
        identifier: 'test-workflow',
        cron: '0 0 * * *',
        child: {
          type: 'fixed-input',
          identifier: v4(),
          input: null,
          output: {
            endpoint: 'PRICE',
            price: {
              symbol: 'BTCUSDT',
            },
          },
          child: {
            type: 'tool',
            identifier: v4(),
            toolIdentifier: 'binance',
            child: {
              identifier: v4(),
              type: 'converter',
              code,
            } as ConverterNode,
          } as ToolNode,
        } as FixedInput,
      },
    } as Workflow;

    const workflowEngine = new WorkflowEngine(
      createJSExecutionEngine(),
      createToolExecutionEngine(),
    );

    const result = await workflowEngine.execute(workflow);

    expect(result).toBeDefined();
    expect(result.data.price.length).toBeGreaterThan(0);
  });
});
