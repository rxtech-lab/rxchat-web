import { getDocumentById } from '@/lib/db/queries';
import { db } from '@/lib/db/queries/client';
import {
  createJobResult,
  getAllJobResultsByJobId,
  getJobById,
  updateJobResult,
  updateJobStatus,
} from '@/lib/db/queries/job';
import { getUserContext } from '@/lib/db/queries/user';
import {
  createJSExecutionEngine,
  createToolExecutionEngine,
} from '@/lib/workflow/engine';
import { createStateClient } from '@/lib/workflow/state';
import { OnStepSchema } from '@/lib/workflow/types';
import { WorkflowEngine } from '@/lib/workflow/workflow-engine';
import { serve } from '@upstash/workflow/nextjs';
import { type NextRequest, NextResponse } from 'next/server';

export const { POST } = serve(
  async (context) => {
    const result = await context.run('Initializing workflow job', async () => {
      const body = context.requestPayload as { jobId: string };
      const result = await db.transaction(async (tx) => {
        const job = await getJobById({
          id: body.jobId,
          dbConnection: tx,
        });
        if (!job) {
          throw new Error('Job not found');
        }

        await updateJobStatus({
          id: job.id,
          status: 'pending',
          dbConnection: tx,
        });
        const userContext = await getUserContext(job.userId);
        const document = await getDocumentById({
          id: job.documentId,
        });

        if (!document) {
          console.error('Document not found', {
            jobId: body.jobId,
            documentId: job.documentId,
          });
          throw new Error('Document not found');
        }

        // check if document is OnStep
        const content = document.content;
        const parsedContent = OnStepSchema.safeParse(
          JSON.parse(content ?? '{}'),
        );
        if (!parsedContent.success) {
          console.error('Invalid document content', {
            error: parsedContent.error,
          });
          throw new Error('Invalid document content');
        }

        const onStep = parsedContent.data;

        // check if onStep is valid

        const jobResult = await createJobResult(
          {
            jobId: job.id,
            status: 'pending',
            result: null,
            reason: null,
          },
          tx,
        );

        return {
          jobResult,
          job,
          workflow: onStep,
          userContext,
        };
      });

      return result;
    });

    const userId = result.job.userId;

    await context.run('Executing workflow job', async () => {
      const workflowEngine = new WorkflowEngine(
        createJSExecutionEngine(),
        createToolExecutionEngine(),
        createStateClient(userId),
      );
      const executionResult = await workflowEngine.execute(
        result.workflow.workflow,
        result.userContext,
      );

      await db.transaction(async (tx) => {
        await updateJobResult({
          id: result.jobResult.id,
          updates: {
            status: 'completed',
            result: JSON.stringify(executionResult),
            reason: null,
          },
          dbConnection: tx,
        });

        await updateJobStatus({
          id: result.job.id,
          status: 'completed',
          dbConnection: tx,
        });
      });
    });

    return NextResponse.json(result);
  },
  {
    failureFunction: async ({ failResponse, failStatus, context }) => {
      console.error('Workflow failed');
      const { jobId } = context.requestPayload as { jobId: string };

      try {
        // Check if there's already a job result for this job
        const existingResults = await getAllJobResultsByJobId({
          jobId,
          status: 'pending',
        });

        if (existingResults.length > 0) {
          // Update the existing pending result to failed
          await updateJobResult({
            id: existingResults[0].id,
            updates: {
              status: 'failed',
              reason: `Workflow failed with status ${failStatus} and response ${failResponse}`,
            },
            dbConnection: db,
          });
        } else {
          // No existing result found, create a new one
          await createJobResult({
            jobId,
            status: 'failed',
            result: null,
            reason: `Workflow failed with status ${failStatus} and response ${failResponse}`,
          });
        }

        // Also update the job status to failed
        await updateJobStatus({
          id: jobId,
          status: 'failed',
          dbConnection: db,
        });
      } catch (error) {
        console.error('Error in failure function:', error);
        // Fallback: still try to create a job result even if the above fails
        try {
          await createJobResult({
            jobId,
            status: 'failed',
            result: null,
            reason: `Workflow failed with status ${failStatus} and response ${failResponse}. Error in failure handler: ${error}`,
          });
        } catch (fallbackError) {
          console.error('Fallback error in failure function:', fallbackError);
        }
      }
    },
  },
);

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Hello, world!' });
}
