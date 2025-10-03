'use server';

import { auth } from '@/app/(auth)/auth';
import {
  getJobById,
  getJobResultsByJobId,
  getAllJobResultsByJobId,
  getJobResultById,
  updateJobResult,
  deleteJobResult,
} from '@/lib/db/queries/job';
import type { Job, JobResult } from '@/lib/db/schema';
import { ChatSDKError } from '@/lib/errors';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Schemas
const GetJobResultsSchema = z.object({
  jobId: z.string().uuid(),
  limit: z.number().default(20),
  offset: z.number().default(0),
  startingAfter: z.string().optional().nullable(),
  endingBefore: z.string().optional().nullable(),
  status: z.enum(['pending', 'completed', 'failed']).optional(),
});

const UpdateJobResultSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'completed', 'failed']),
  reason: z.string().optional(),
  result: z.any().optional(),
});

const DeleteJobResultSchema = z.object({
  id: z.string().uuid(),
});

export type ActionResult = {
  success: boolean;
  message: string;
  error?: string;
};

export interface GetJobResults {
  jobResults: JobResult[];
  hasMore: boolean;
  job: Job;
}

/**
 * Server action to get job results with pagination
 */
export async function getJobResults({
  jobId,
  limit = 20,
  offset = 0,
  startingAfter,
  endingBefore,
  status,
}: z.infer<typeof GetJobResultsSchema>): Promise<GetJobResults> {
  const session = await auth();

  if (!session?.user) {
    throw new ChatSDKError('unauthorized:chat', 'Authentication required');
  }

  const parsed = GetJobResultsSchema.safeParse({
    jobId,
    limit,
    offset,
    startingAfter,
    endingBefore,
    status,
  });

  if (!parsed.success) {
    throw new ChatSDKError('bad_request:chat', 'Invalid pagination parameters');
  }

  try {
    // Verify job exists and belongs to user
    const job = await getJobById({ id: parsed.data.jobId });

    if (!job) {
      throw new ChatSDKError('not_found:chat', 'Job not found');
    }

    if (job.userId !== session.user.id) {
      throw new ChatSDKError('forbidden:chat', 'Access denied');
    }

    const result = await getJobResultsByJobId({
      jobId: parsed.data.jobId,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      startingAfter: parsed.data.startingAfter || null,
      endingBefore: parsed.data.endingBefore || null,
      status: parsed.data.status,
    });

    return {
      jobResults: result.jobResults,
      hasMore: result.hasMore,
      job,
    };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError('bad_request:chat', 'Failed to fetch job results');
  }
}

/**
 * Server action to get all job results (without pagination)
 */
export async function getAllJobResults({
  jobId,
  status,
}: {
  jobId: string;
  status?: 'pending' | 'completed' | 'failed';
}) {
  const session = await auth();

  if (!session?.user) {
    throw new ChatSDKError('unauthorized:chat', 'Authentication required');
  }

  try {
    // Verify job exists and belongs to user
    const job = await getJobById({ id: jobId });

    if (!job) {
      throw new ChatSDKError('not_found:chat', 'Job not found');
    }

    if (job.userId !== session.user.id) {
      throw new ChatSDKError('forbidden:chat', 'Access denied');
    }

    const jobResults = await getAllJobResultsByJobId({
      jobId,
      status,
    });

    return {
      jobResults,
      job,
    };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError('bad_request:chat', 'Failed to fetch job results');
  }
}

/**
 * Server action to get a single job result
 */
export async function getJobResult({ id }: { id: string }) {
  const session = await auth();

  if (!session?.user) {
    throw new ChatSDKError('unauthorized:chat', 'Authentication required');
  }

  try {
    const jobResult = await getJobResultById({ id });

    if (!jobResult) {
      throw new ChatSDKError('not_found:chat', 'Job result not found');
    }

    // Get the associated job to verify ownership
    const job = await getJobById({ id: jobResult.jobId });

    if (!job || job.userId !== session.user.id) {
      throw new ChatSDKError('forbidden:chat', 'Access denied');
    }

    return { jobResult, job };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError('bad_request:chat', 'Failed to fetch job result');
  }
}

/**
 * Server action to update a job result
 */
export async function updateJobResultAction({
  id,
  status,
  reason,
  result,
}: {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  reason?: string;
  result?: any;
}): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user) {
    return {
      success: false,
      message: 'Authentication required',
      error: 'Unauthorized',
    };
  }

  const parsed = UpdateJobResultSchema.safeParse({
    id,
    status,
    reason,
    result,
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Invalid parameters',
      error: 'Bad Request',
    };
  }

  try {
    // Verify job result exists and user owns the job
    const jobResult = await getJobResultById({ id: parsed.data.id });

    if (!jobResult) {
      return {
        success: false,
        message: 'Job result not found',
        error: 'Not Found',
      };
    }

    const job = await getJobById({ id: jobResult.jobId });

    if (!job || job.userId !== session.user.id) {
      return {
        success: false,
        message: 'Access denied',
        error: 'Forbidden',
      };
    }

    await updateJobResult({
      id: parsed.data.id,
      updates: {
        status: parsed.data.status,
        reason: parsed.data.reason,
        result: parsed.data.result,
      },
    });

    revalidatePath(`/jobs/${job.id}/results`);

    return {
      success: true,
      message: 'Job result updated successfully',
    };
  } catch (error) {
    console.error('Update job result error:', error);
    return {
      success: false,
      message: 'Failed to update job result',
      error: 'Internal Server Error',
    };
  }
}

/**
 * Server action to delete a job result
 */
export async function deleteJobResultAction({
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

  const parsed = DeleteJobResultSchema.safeParse({ id });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Invalid job result ID',
      error: 'Bad Request',
    };
  }

  try {
    // Verify job result exists and user owns the job
    const jobResult = await getJobResultById({ id: parsed.data.id });

    if (!jobResult) {
      return {
        success: false,
        message: 'Job result not found',
        error: 'Not Found',
      };
    }

    const job = await getJobById({ id: jobResult.jobId });

    if (!job || job.userId !== session.user.id) {
      return {
        success: false,
        message: 'Access denied',
        error: 'Forbidden',
      };
    }

    await deleteJobResult({ id: parsed.data.id });

    revalidatePath(`/jobs/${job.id}/results`);

    return {
      success: true,
      message: 'Job result deleted successfully',
    };
  } catch (error) {
    console.error('Delete job result error:', error);
    return {
      success: false,
      message: 'Failed to delete job result',
      error: 'Internal Server Error',
    };
  }
}
