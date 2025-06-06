import { agent } from './agent';
import { WorkflowSchema } from '@/lib/workflow/types';

describe('agent', () => {
  it('should be able to create workflow', async () => {
    // don't run this workflow in CI as it takes too long
    if (process.env.CI === 'true') {
      expect(true).toBeTruthy();
      return;
    }
    const workflow = await agent(
      'Create a workflow to create a crypto trading',
    );
    expect(workflow?.workflow).toBeDefined();

    console.dir(workflow, { depth: null });
    expect(() =>
      WorkflowSchema.safeParse(workflow?.workflow.getWorkflow()),
    ).not.toThrow();
  }, 300_000);
});
