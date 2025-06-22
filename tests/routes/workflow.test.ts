import { getUsers } from '@/lib/db/queries';
import { createDocument } from '@/lib/db/queries/document';
import { createJob } from '@/lib/db/queries/job';
import type { OnStep, Workflow } from '@/lib/workflow/types';
import { v4 } from 'uuid';
import { expect, test } from '../fixtures';

test.describe('Workflow endpoint', () => {
  const workflowDocument: OnStep = {
    title: '',
    type: 'error',
    error: null,
    toolDiscovery: null,
    suggestion: null,
    workflow: {
      trigger: {
        type: 'cronjob-trigger',
        identifier: v4(),
        cron: '0 0 * * *',
        child: null,
      },
    } as Workflow,
  };

  test('should trigger a workflow', async ({ request, page, adaContext }) => {
    // create a user
    const [user] = await getUsers(1, 0);
    expect(user).toBeDefined();

    const documentCreated = await createDocument({
      title: 'Test Document',
      userId: user.id,
      kind: 'flowchart',
      content: JSON.stringify(workflowDocument),
    });
    // create a job
    const job = await createJob({
      status: 'pending',
      userId: user.id,
      documentId: documentCreated.id,
      documentCreatedAt: documentCreated.createdAt,
      runningStatus: 'running',
      jobTriggerType: 'cronjob',
      cron: null,
    });

    const response = await request.post('/api/workflow', {
      headers: {
        Authorization: `Bearer ${process.env.QSTASH_TOKEN}`,
      },
      data: {
        jobId: job.id,
      },
    });
    expect(response.status()).toBe(200);
  });
});
