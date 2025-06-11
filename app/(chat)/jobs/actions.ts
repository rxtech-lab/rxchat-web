'use server';

import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db/queries/client';
import {
  deleteJob,
  deleteJobsByIds,
  updateJobRunningStatus,
  getJobsByUserId,
  getJobById,
} from '@/lib/db/queries/job';
import { ChatSDKError } from '@/lib/errors';
import { Client } from '@upstash/qstash';
import { MAX_WORKFLOW_RETRIES } from '@/lib/constants';
import { getWorkflowWebhookUrl } from '@/lib/workflow/utils';
import { Client as WorkflowClient } from '@upstash/workflow';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const qStashClient = new Client({
  token: process.env.QSTASH_TOKEN,
  baseUrl: process.env.QSTASH_URL,
});

const workflowClient = new WorkflowClient({
  token: process.env.QSTASH_TOKEN,
});

// Schemas
const DeleteJobSchema = z.object({
  id: z.string().uuid(),
});

const DeleteJobsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

const UpdateJobRunningStatusSchema = z.object({
  id: z.string().uuid(),
  runningStatus: z.enum(['stopped', 'running']),
});

const GetJobsSchema = z.object({
  limit: z.number().default(20),
  startingAfter: z.string().optional().nullable(),
  endingBefore: z.string().optional().nullable(),
  status: z.enum(['pending', 'completed', 'failed']).optional(),
  runningStatus: z.enum(['stopped', 'running']).optional(),
});

export type ActionResult = {
  success: boolean;
  message: string;
  error?: string;
};

/**
 * Server action to get jobs with pagination
 */
export async function getJobs({
  limit = 20,
  startingAfter,
  endingBefore,
  status,
  runningStatus,
}: {
  limit?: number;
  startingAfter?: string | null;
  endingBefore?: string | null;
  status?: 'pending' | 'completed' | 'failed';
  runningStatus?: 'stopped' | 'running';
}) {
  const session = await auth();

  if (!session?.user) {
    throw new ChatSDKError('unauthorized:chat', 'Authentication required');
  }

  const parsed = GetJobsSchema.safeParse({
    limit,
    startingAfter,
    endingBefore,
    status,
    runningStatus,
  });

  if (!parsed.success) {
    throw new ChatSDKError('bad_request:chat', 'Invalid pagination parameters');
  }

  try {
    const result = await getJobsByUserId({
      userId: session.user.id,
      limit: parsed.data.limit,
      startingAfter: parsed.data.startingAfter || null,
      endingBefore: parsed.data.endingBefore || null,
      status: parsed.data.status,
      runningStatus: parsed.data.runningStatus,
    });

    return {
      jobs: result.jobs,
      hasMore: result.hasMore,
    };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError('bad_request:chat', 'Failed to fetch jobs');
  }
}

/**
 * Server action to get a single job by ID
 */
export async function getJob({ id }: { id: string }) {
  const session = await auth();

  if (!session?.user) {
    throw new ChatSDKError('unauthorized:chat', 'Authentication required');
  }

  try {
    const job = await getJobById({ id });

    if (!job) {
      throw new ChatSDKError('not_found:chat', 'Job not found');
    }

    if (job.userId !== session.user.id) {
      throw new ChatSDKError('forbidden:chat', 'Access denied');
    }

    return job;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError('bad_request:chat', 'Failed to fetch job');
  }
}

/**
 * Server action to delete a single job
 */
export async function deleteJobAction({
  id,
}: { id: string }): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user) {
    return {
      success: false,
      message: 'Authentication required',
      error: 'Unauthorized',
    };
  }

  const parsed = DeleteJobSchema.safeParse({ id });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Invalid job ID',
      error: 'Bad Request',
    };
  }

  try {
    // Verify job exists and belongs to user
    const job = await getJobById({ id: parsed.data.id });

    if (!job) {
      return {
        success: false,
        message: 'Job not found',
        error: 'Not Found',
      };
    }

    if (job.userId !== session.user.id) {
      return {
        success: false,
        message: 'Access denied',
        error: 'Forbidden',
      };
    }

    await db.transaction(async (tx) => {
      await qStashClient.schedules.delete(parsed.data.id);
      await deleteJob({ id: parsed.data.id, dbConnection: tx });
    });

    revalidatePath('/jobs');

    return {
      success: true,
      message: 'Job deleted successfully',
    };
  } catch (error) {
    console.error('Delete job error:', error);
    return {
      success: false,
      message: 'Failed to delete job',
      error: 'Internal Server Error',
    };
  }
}

/**
 * Server action to delete multiple jobs
 */
export async function deleteJobsAction({
  ids,
}: { ids: string[] }): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user) {
    return {
      success: false,
      message: 'Authentication required',
      error: 'Unauthorized',
    };
  }

  const parsed = DeleteJobsSchema.safeParse({ ids });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Invalid job IDs',
      error: 'Bad Request',
    };
  }

  try {
    // Verify all jobs exist and belong to user
    const jobs = await Promise.all(
      parsed.data.ids.map((id) => getJobById({ id })),
    );

    const notFoundJobs = jobs.filter((job) => !job);
    if (notFoundJobs.length > 0) {
      return {
        success: false,
        message: 'Some jobs not found',
        error: 'Not Found',
      };
    }

    const unauthorizedJobs = jobs.filter(
      (job) => job && job.userId !== session.user.id,
    );
    if (unauthorizedJobs.length > 0) {
      return {
        success: false,
        message: 'Access denied to some jobs',
        error: 'Forbidden',
      };
    }

    await db.transaction(async (tx) => {
      for (const id of parsed.data.ids) {
        await qStashClient.schedules.delete(id);
      }
      await deleteJobsByIds({ ids: parsed.data.ids, dbConnection: tx });
    });

    revalidatePath('/jobs');

    return {
      success: true,
      message: `${parsed.data.ids.length} job(s) deleted successfully`,
    };
  } catch (error) {
    console.error('Delete jobs error:', error);
    return {
      success: false,
      message: 'Failed to delete jobs',
      error: 'Internal Server Error',
    };
  }
}

/**
 * Server action to update job running status
 */
export async function updateJobRunningStatusAction({
  id,
  runningStatus,
}: {
  id: string;
  runningStatus: 'stopped' | 'running';
}): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user) {
    return {
      success: false,
      message: 'Authentication required',
      error: 'Unauthorized',
    };
  }

  const parsed = UpdateJobRunningStatusSchema.safeParse({ id, runningStatus });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Invalid parameters',
      error: 'Bad Request',
    };
  }

  try {
    // Verify job exists and belongs to user
    const job = await getJobById({ id: parsed.data.id });

    if (!job) {
      return {
        success: false,
        message: 'Job not found',
        error: 'Not Found',
      };
    }

    if (job.userId !== session.user.id) {
      return {
        success: false,
        message: 'Access denied',
        error: 'Forbidden',
      };
    }

    await db.transaction(async (tx) => {
      if (parsed.data.runningStatus === 'stopped') {
        await qStashClient.schedules.pause({ schedule: job.id });
      } else {
        await qStashClient.schedules.resume({ schedule: job.id });
      }
      await updateJobRunningStatus({
        id: parsed.data.id,
        runningStatus: parsed.data.runningStatus,
        dbConnection: tx,
      });
    });

    revalidatePath('/jobs');
    revalidatePath(`/jobs/${id}/results`);

    return {
      success: true,
      message: `Job ${runningStatus === 'running' ? 'started' : 'stopped'} successfully`,
    };
  } catch (error) {
    console.error('Update job running status error:', error);
    return {
      success: false,
      message: 'Failed to update job status',
      error: 'Internal Server Error',
    };
  }
}

export async function triggerJobAction({
  id,
}: {
  id: string;
}): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user) {
    return {
      success: false,
      message: 'Authentication required',
      error: 'Unauthorized',
    };
  }

  const job = await getJobById({ id });

  if (!job) {
    return {
      success: false,
      message: 'Job not found',
      error: 'Not Found',
    };
  }

  const url = getWorkflowWebhookUrl();
  await workflowClient.trigger({
    url: url.toString(),
    workflowRunId: `${job.id}-run-${Date.now()}`,
    body: JSON.stringify({
      jobId: job.id,
    }),
    retries: MAX_WORKFLOW_RETRIES,
  });

  return {
    success: true,
    message: 'Job triggered successfully',
  };
}
