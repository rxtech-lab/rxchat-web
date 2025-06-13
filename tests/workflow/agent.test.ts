import { agent } from '@/lib/workflow/agent';
import {
  createJSExecutionEngine,
  createToolExecutionEngine,
} from '@/lib/workflow/engine';
import { createTestToolExecutionEngine } from '@/lib/workflow/engine/testToolExecutionEngine';
import { WorkflowEngine } from '@/lib/workflow/workflow-engine';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  testInfo.setTimeout(testInfo.timeout + 30_000);
});

test.describe('agent integration test', () => {
  test('should be able to create a simple btc price alert workflow', async () => {
    const workflow = await agent('Create a workflow to fetch BTCUSDT price');
    expect(workflow?.workflow).toBeDefined();

    console.dir(workflow, { depth: null });
    const workflowEngine = new WorkflowEngine(
      createJSExecutionEngine(),
      createToolExecutionEngine(),
    );

    const result = await workflowEngine.execute(workflow.workflow);
    expect(result.data.price.length).toBeGreaterThan(0);
    console.dir(result, { depth: null });
  });

  test('should be able to create a simple btc price alert workflow that runs every 10 minutes', async () => {
    const workflow = await agent(
      'Create a workflow to fetch BTCUSDT price every 10 minutes',
    );
    expect(workflow?.workflow).toBeDefined();

    console.dir(workflow, { depth: null });
    const workflowEngine = new WorkflowEngine(
      createJSExecutionEngine(),
      createToolExecutionEngine(),
    );

    const cron = workflow.workflow.trigger.cron;
    // Check if cron expression is for every 10 minutes
    expect(['*/10 * * * *', '0 */10 * * *']).toContain(cron);
    const result = await workflowEngine.execute(workflow.workflow);
    expect(result.data.price.length).toBeGreaterThan(0);
    console.dir(result, { depth: null });
  });

  test.skip('should be able to create a simple notification bot that triggers every 10 minutes', async () => {
    const workflow = await agent(
      'Create a workflow to fetch BTCUSDT price every 10 minutes and then send a notification using telegram',
    );
    expect(workflow?.workflow).toBeDefined();

    console.dir(workflow, { depth: null });
    const toolExecutionEngine = createTestToolExecutionEngine();
    const workflowEngine = new WorkflowEngine(
      createJSExecutionEngine(),
      toolExecutionEngine, // cant use real tool for telegram bot
    );

    await workflowEngine.execute(workflow.workflow);
    expect(toolExecutionEngine.getCallCount('telegram')).toBe(1);
    expect(toolExecutionEngine.getCallArgs('telegram')).toHaveProperty('data');

    const result = await workflowEngine.execute(workflow.workflow);
    expect(result.data.price.length).toBeGreaterThan(0);
    console.dir(result, { depth: null });
  });
});
