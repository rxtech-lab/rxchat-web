import {
  createJSExecutionEngine,
  createToolExecutionEngine,
} from '@/lib/workflow/engine';
import { createTestStateClient } from '@/lib/workflow/state/test';
import type {
  ConverterNode,
  FixedInput,
  ToolNode,
  Workflow,
} from '@/lib/workflow/types';
import { WorkflowEngine } from '@/lib/workflow/workflow-engine';
import { expect, test } from '@playwright/test';
import { v4 } from 'uuid';

const code = `

async function handle(input: any) {
  return input.input;
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
            symbol: 'BTCUSDT',
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
      createTestStateClient('e2e'),
    );

    const result = await workflowEngine.execute(workflow);

    expect(result).toBeDefined();
    expect(result.price).toBeGreaterThan(0);
  });
});
