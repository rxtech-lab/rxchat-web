'server-only';

import { ChatSDKError } from '@/lib/errors';
import { and, desc, eq, gt, inArray, lt, type SQL } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  Job,
  JobResult,
  type Job as JobType,
  type JobResult as JobResultType,
} from '../schema';
import { db } from './client';

type DatabaseConnection = typeof db | PgDatabase<any>;

// ============================================
// JOB CRUD OPERATIONS
// ============================================

/**
 * Create a new job
 */
export async function createJob(
  jobData: Omit<JobType, 'id' | 'createdAt' | 'updatedAt'>,
  dbConnection: DatabaseConnection = db,
): Promise<JobType> {
  try {
    const now = new Date();
    const newJob = await dbConnection
      .insert(Job)
      .values({
        ...jobData,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return newJob[0];
  } catch (error) {
    console.error(error);
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while creating the job.',
    );
  }
}

export async function getJobByDocumentId({
  documentId,
  dbConnection = db,
}: {
  documentId: string;
  dbConnection?: DatabaseConnection;
}): Promise<JobType | null> {
  try {
    const [job] = await dbConnection
      .select()
      .from(Job)
      .where(eq(Job.documentId, documentId))
      .limit(1);

    return job || null;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get job by document id',
    );
  }
}

/**
 * Get job by ID
 */
export async function getJobById({
  id,
  dbConnection = db,
}: {
  id: string;
  dbConnection?: DatabaseConnection;
}): Promise<JobType | null> {
  try {
    const [job] = await dbConnection
      .select()
      .from(Job)
      .where(eq(Job.id, id))
      .limit(1);

    return job || null;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get job by id');
  }
}

/**
 * Get jobs by user ID with pagination
 */
export async function getJobsByUserId({
  userId,
  limit,
  startingAfter,
  endingBefore,
  status,
  runningStatus,
  dbConnection = db,
}: {
  userId: string;
  limit: number;
  startingAfter?: string | null;
  endingBefore?: string | null;
  status?: 'pending' | 'completed' | 'failed';
  runningStatus?: 'stopped' | 'running';
  dbConnection?: DatabaseConnection;
}) {
  try {
    const extendedLimit = limit + 1;

    const buildWhereCondition = (timeCondition?: SQL<any>) => {
      const conditions = [eq(Job.userId, userId)];

      if (timeCondition) {
        conditions.push(timeCondition);
      }

      if (status) {
        conditions.push(eq(Job.status, status));
      }

      if (runningStatus) {
        conditions.push(eq(Job.runningStatus, runningStatus));
      }

      return and(...conditions);
    };

    const query = (whereCondition?: SQL<any>) =>
      dbConnection
        .select()
        .from(Job)
        .where(buildWhereCondition(whereCondition))
        .orderBy(desc(Job.createdAt))
        .limit(extendedLimit);

    let filteredJobs: Array<JobType> = [];

    if (startingAfter) {
      const [selectedJob] = await dbConnection
        .select()
        .from(Job)
        .where(eq(Job.id, startingAfter))
        .limit(1);

      if (!selectedJob) {
        throw new ChatSDKError('not_found:database', 'Starting job not found.');
      }

      filteredJobs = await query(gt(Job.createdAt, selectedJob.createdAt));
    } else if (endingBefore) {
      const [selectedJob] = await dbConnection
        .select()
        .from(Job)
        .where(eq(Job.id, endingBefore))
        .limit(1);

      if (!selectedJob) {
        throw new ChatSDKError('not_found:database', 'Ending job not found.');
      }

      filteredJobs = await query(lt(Job.createdAt, selectedJob.createdAt));
    } else {
      filteredJobs = await query();
    }

    const hasMore = filteredJobs.length > limit;

    return {
      jobs: hasMore ? filteredJobs.slice(0, limit) : filteredJobs,
      hasMore,
    };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while fetching jobs.',
    );
  }
}

/**
 * Update job
 */
export async function updateJob({
  id,
  updates,
  dbConnection = db,
}: {
  id: string;
  updates: Partial<Omit<JobType, 'id' | 'createdAt'>>;
  dbConnection?: DatabaseConnection;
}): Promise<JobType> {
  try {
    const updatedJob = await dbConnection
      .update(Job)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(Job.id, id))
      .returning();

    if (!updatedJob[0]) {
      throw new ChatSDKError('not_found:database', 'Job not found.');
    }

    return updatedJob[0];
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while updating the job.',
    );
  }
}

/**
 * Update job running status specifically
 */
export async function updateJobRunningStatus({
  id,
  runningStatus,
  dbConnection = db,
}: {
  id: string;
  runningStatus: 'stopped' | 'running';
  dbConnection?: DatabaseConnection;
}): Promise<JobType> {
  try {
    const updatedJob = await dbConnection
      .update(Job)
      .set({
        runningStatus,
        updatedAt: new Date(),
      })
      .where(eq(Job.id, id))
      .returning();

    if (!updatedJob[0]) {
      throw new ChatSDKError('not_found:database', 'Job not found.');
    }

    return updatedJob[0];
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while updating job running status.',
    );
  }
}

/**
 * Update job running status specifically
 */
export async function updateJobStatus({
  id,
  status,
  dbConnection = db,
}: {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  dbConnection?: DatabaseConnection;
}): Promise<JobType> {
  try {
    const updatedJob = await dbConnection
      .update(Job)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(Job.id, id))
      .returning();

    if (!updatedJob[0]) {
      throw new ChatSDKError('not_found:database', 'Job not found.');
    }

    return updatedJob[0];
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while updating job running status.',
    );
  }
}

/**
 * Delete job by ID
 */
export async function deleteJob({
  id,
  dbConnection = db,
}: {
  id: string;
  dbConnection?: DatabaseConnection;
}): Promise<void> {
  try {
    await dbConnection.delete(Job).where(eq(Job.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while deleting the job.',
    );
  }
}

/**
 * Delete jobs by IDs
 */
export async function deleteJobsByIds({
  ids,
  dbConnection = db,
}: {
  ids: Array<string>;
  dbConnection?: DatabaseConnection;
}): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  try {
    await dbConnection.delete(Job).where(inArray(Job.id, ids));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while deleting jobs.',
    );
  }
}

// ============================================
// JOB RESULT CRUD OPERATIONS
// ============================================

/**
 * Create a new job result
 */
export async function createJobResult(
  jobResultData: Omit<JobResultType, 'id' | 'createdAt' | 'updatedAt'>,
  dbConnection: DatabaseConnection = db,
): Promise<JobResultType> {
  try {
    const now = new Date();
    const newJobResult = await dbConnection
      .insert(JobResult)
      .values({
        ...jobResultData,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return newJobResult[0];
  } catch (error) {
    console.error(error);
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while creating the job result.',
    );
  }
}

/**
 * Get job result by ID
 */
export async function getJobResultById({
  id,
  dbConnection = db,
}: {
  id: string;
  dbConnection?: DatabaseConnection;
}): Promise<JobResultType | null> {
  try {
    const [jobResult] = await dbConnection
      .select()
      .from(JobResult)
      .where(eq(JobResult.id, id))
      .limit(1);

    return jobResult || null;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get job result by id',
    );
  }
}

/**
 * Get job results by job ID with pagination
 */
export async function getJobResultsByJobId({
  jobId,
  limit,
  offset = 0,
  startingAfter,
  endingBefore,
  status,
  dbConnection = db,
}: {
  jobId: string;
  limit: number;
  offset?: number;
  startingAfter?: string | null;
  endingBefore?: string | null;
  status?: 'pending' | 'completed' | 'failed';
  dbConnection?: DatabaseConnection;
}) {
  try {
    // Use offset-based pagination if offset is provided, otherwise fall back to cursor-based
    if (offset !== undefined && offset >= 0) {
      const extendedLimit = limit + 1;

      const buildWhereCondition = () => {
        const conditions = [eq(JobResult.jobId, jobId)];

        if (status) {
          conditions.push(eq(JobResult.status, status));
        }

        return and(...conditions);
      };

      const filteredJobResults = await dbConnection
        .select()
        .from(JobResult)
        .where(buildWhereCondition())
        .orderBy(desc(JobResult.createdAt))
        .limit(extendedLimit)
        .offset(offset);

      const hasMore = filteredJobResults.length > limit;

      return {
        jobResults: hasMore
          ? filteredJobResults.slice(0, limit)
          : filteredJobResults,
        hasMore,
      };
    }

    // Original cursor-based pagination logic for backward compatibility
    const extendedLimit = limit + 1;

    const buildWhereCondition = (timeCondition?: SQL<any>) => {
      const conditions = [eq(JobResult.jobId, jobId)];

      if (timeCondition) {
        conditions.push(timeCondition);
      }

      if (status) {
        conditions.push(eq(JobResult.status, status));
      }

      return and(...conditions);
    };

    const query = (whereCondition?: SQL<any>) =>
      dbConnection
        .select()
        .from(JobResult)
        .where(buildWhereCondition(whereCondition))
        .orderBy(desc(JobResult.createdAt))
        .limit(extendedLimit);

    let filteredJobResults: Array<JobResultType> = [];

    if (startingAfter) {
      const [selectedJobResult] = await dbConnection
        .select()
        .from(JobResult)
        .where(eq(JobResult.id, startingAfter))
        .limit(1);

      if (!selectedJobResult) {
        throw new ChatSDKError(
          'not_found:database',
          'Starting job result not found.',
        );
      }

      filteredJobResults = await query(
        gt(JobResult.createdAt, selectedJobResult.createdAt),
      );
    } else if (endingBefore) {
      const [selectedJobResult] = await dbConnection
        .select()
        .from(JobResult)
        .where(eq(JobResult.id, endingBefore))
        .limit(1);

      if (!selectedJobResult) {
        throw new ChatSDKError(
          'not_found:database',
          'Ending job result not found.',
        );
      }

      filteredJobResults = await query(
        lt(JobResult.createdAt, selectedJobResult.createdAt),
      );
    } else {
      filteredJobResults = await query();
    }

    const hasMore = filteredJobResults.length > limit;

    return {
      jobResults: hasMore
        ? filteredJobResults.slice(0, limit)
        : filteredJobResults,
      hasMore,
    };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while fetching job results.',
    );
  }
}

/**
 * Update job result
 */
export async function updateJobResult({
  id,
  updates,
  dbConnection = db,
}: {
  id: string;
  updates: Partial<Omit<JobResultType, 'id' | 'createdAt'>>;
  dbConnection?: DatabaseConnection;
}): Promise<JobResultType> {
  try {
    const updatedJobResult = await dbConnection
      .update(JobResult)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(JobResult.id, id))
      .returning();

    if (!updatedJobResult[0]) {
      throw new ChatSDKError('not_found:database', 'Job result not found.');
    }

    return updatedJobResult[0];
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while updating the job result.',
    );
  }
}

/**
 * Delete job result by ID
 */
export async function deleteJobResult({
  id,
  dbConnection = db,
}: {
  id: string;
  dbConnection?: DatabaseConnection;
}): Promise<void> {
  try {
    await dbConnection.delete(JobResult).where(eq(JobResult.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while deleting the job result.',
    );
  }
}

/**
 * Delete job results by IDs
 */
export async function deleteJobResultsByIds({
  ids,
  dbConnection = db,
}: {
  ids: Array<string>;
  dbConnection?: DatabaseConnection;
}): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  try {
    await dbConnection.delete(JobResult).where(inArray(JobResult.id, ids));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while deleting job results.',
    );
  }
}

/**
 * Get all job results for a job (without pagination)
 */
export async function getAllJobResultsByJobId({
  jobId,
  status,
  dbConnection = db,
}: {
  jobId: string;
  status?: 'pending' | 'completed' | 'failed';
  dbConnection?: DatabaseConnection;
}): Promise<JobResultType[]> {
  try {
    const jobResults = await dbConnection
      .select()
      .from(JobResult)
      .where(
        status
          ? and(eq(JobResult.jobId, jobId), eq(JobResult.status, status))
          : eq(JobResult.jobId, jobId),
      )
      .orderBy(desc(JobResult.createdAt));

    return jobResults;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while fetching all job results.',
    );
  }
}
