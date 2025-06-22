import { agent } from '@/lib/workflow/agent';
import {
  createJSExecutionEngine,
  createToolExecutionEngine,
} from '@/lib/workflow/engine';
import { createTestToolExecutionEngine } from '@/lib/workflow/engine/testToolExecutionEngine';
import { createTestStateClient } from '@/lib/workflow/state/test';
import { WorkflowEngine } from '@/lib/workflow/workflow-engine';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  const isUsingLmStudio = process.env.USE_LM_STUDIO === 'true';
  if (isUsingLmStudio) {
    testInfo.setTimeout(testInfo.timeout + 200_000);
  } else {
    testInfo.setTimeout(testInfo.timeout + 100_000);
  }
});

test.describe('agent integration test', () => {
  test('should be able to create a simple btc price alert workflow', async () => {
    const workflow = await agent('Create a workflow to fetch BTCUSDT price');
    expect(workflow?.workflow).toBeDefined();

    console.dir(workflow, { depth: null });
    const workflowEngine = new WorkflowEngine(
      createJSExecutionEngine(),
      createToolExecutionEngine(),
      createTestStateClient('e2e'),
    );

    const result = await workflowEngine.execute(workflow.workflow);
    expect(result.price).toBeGreaterThan(0);
    console.dir(result, { depth: null });
  });

  test('should be able to create a simple btc price alert workflow that runs every 10 minutes', async () => {
    const workflow = await agent(
      'Create a workflow to fetch BTCUSDT price every 10 minutes',
    );
    expect(workflow?.workflow).toBeDefined();

    const workflowEngine = new WorkflowEngine(
      createJSExecutionEngine(),
      createToolExecutionEngine(),
      createTestStateClient('e2e'),
    );

    const cron = workflow.workflow.trigger.cron;
    // Check if cron expression is for every 10 minutes
    expect(['*/10 * * * *', '0 */10 * * *']).toContain(cron);
    const result = await workflowEngine.execute(workflow.workflow);
    expect(result.price).toBeGreaterThan(0);
    console.dir(result, { depth: null });
  });

  test('should be able to create a simple notification bot that triggers every 10 minutes', async () => {
    const workflow = await agent(
      'Create a workflow to fetch BTCUSDT price every 10 minutes and then send a notification using telegram',
    );
    expect(workflow?.workflow).toBeDefined();

    console.dir(workflow, { depth: null });

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
      createTestStateClient('e2e'),
    );

    await workflowEngine.execute(workflow.workflow, {
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
});
