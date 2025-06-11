import { test } from '@playwright/test';
import type { ConverterNode, ToolNode, Workflow } from '@/lib/workflow/types';
import { v4 } from 'uuid';

const code = `

async function handle(input: any) {


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
          identifier: v4(),
          toolIdentifier: 'binance',
          child: {
            identifier: v4(),
            code: code,
          } as ConverterNode,
        } as ToolNode,
      },
    } as Workflow;
  });
});
