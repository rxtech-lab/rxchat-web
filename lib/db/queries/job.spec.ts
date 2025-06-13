import { v4 } from 'uuid';

jest.mock('server-only', () => ({}));

// Mock bcrypt-ts to avoid ESM import issues in Jest
jest.mock('bcrypt-ts', () => ({
  genSaltSync: jest.fn(() => 'mock-salt'),
  hashSync: jest.fn((password: string) => `mock-hash-${password}`),
  compare: jest.fn(() => Promise.resolve(true)),
  compareSync: jest.fn(() => true),
}));

import {
  createJob,
  getJobById,
  getJobsByUserId,
  updateJob,
  updateJobRunningStatus,
  deleteJob,
  deleteJobsByIds,
  createJobResult,
  getJobResultById,
  getJobResultsByJobId,
  updateJobResult,
  deleteJobResult,
  deleteJobResultsByIds,
  getAllJobResultsByJobId,
} from './job';
import { createUser, deleteUserAccount, saveDocument } from './queries';
import { ChatSDKError } from '@/lib/errors';
import type { Job as JobType, JobResult as JobResultType } from '../schema';
import { generateRandomTestUser } from '@/tests/helpers';
import { db } from '@/lib/db/queries/client';

jest.retryTimes(3, {
  logErrorsBeforeRetry: true,
});

/**
 * Test utilities for creating mock data
 */
const createMockJob = (
  userId: string,
  documentId: string,
  documentCreatedAt: Date,
  overrides: Partial<JobType> = {},
): Omit<JobType, 'id' | 'createdAt' | 'updatedAt'> =>
  ({
    userId,
    documentId,
    documentCreatedAt,
    status: 'pending',
    runningStatus: 'stopped',
    ...overrides,
  }) as any;

const createMockJobResult = (
  jobId: string,
  overrides: Partial<JobResultType> = {},
): Omit<JobResultType, 'id' | 'createdAt' | 'updatedAt'> => ({
  jobId,
  status: 'pending',
  result: null,
  reason: null,
  ...overrides,
});

describe('Job Queries', () => {
  let testUserId: string;
  let testDocumentId: string;
  let testDocumentCreatedAt: Date;

  /**
   * Creates a test user and document before each test
   */
  beforeEach(async () => {
    const user = generateRandomTestUser();
    const [testUser] = await createUser(user.email, user.password);
    testUserId = testUser.id;

    // Create a test document for job foreign key constraint
    testDocumentId = v4();
    testDocumentCreatedAt = new Date();
    await saveDocument({
      id: testDocumentId,
      title: 'Test Document for Job',
      kind: 'text',
      content: 'Test document content',
      userId: testUserId,
    });
  });

  /**
   * Cleans up test user and associated data after each test
   */
  afterEach(async () => {
    if (testUserId) {
      await deleteUserAccount({ id: testUserId });
    }
  });

  afterAll(() => {
    // Cleanup database connections or any global state if needed
    jest.clearAllMocks();
    db.$client.end();
  });

  describe('Job CRUD Operations', () => {
    describe('createJob', () => {
      test('should create a job successfully', async () => {
        const mockJob = createMockJob(
          testUserId,
          testDocumentId,
          testDocumentCreatedAt,
        );

        const result = await createJob(mockJob);

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.userId).toBe(testUserId);
        expect(result.documentId).toBe(testDocumentId);
        expect(result.documentCreatedAt).toEqual(testDocumentCreatedAt);
        expect(result.status).toBe('pending');
        expect(result.runningStatus).toBe('stopped');
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
      });

      test('should create a job with custom status', async () => {
        const mockJob = createMockJob(
          testUserId,
          testDocumentId,
          testDocumentCreatedAt,
          {
            status: 'completed',
            runningStatus: 'running',
          },
        );

        const result = await createJob(mockJob);

        expect(result.status).toBe('completed');
        expect(result.runningStatus).toBe('running');
      });

      test('should throw ChatSDKError when database operation fails', async () => {
        const mockJob = createMockJob(
          'invalid-user-id',
          testDocumentId,
          testDocumentCreatedAt,
        );

        await expect(createJob(mockJob)).rejects.toThrow(ChatSDKError);
        await expect(createJob(mockJob)).rejects.toThrow(
          'An error occurred while executing a database query.',
        );
      });
    });

    describe('getJobById', () => {
      let jobId: string;

      beforeEach(async () => {
        const mockJob = createMockJob(
          testUserId,
          testDocumentId,
          testDocumentCreatedAt,
        );
        const createdJob = await createJob(mockJob);
        jobId = createdJob.id;
      });

      test('should get job by ID successfully', async () => {
        const result = await getJobById({ id: jobId });

        expect(result).toBeDefined();
        expect(result?.id).toBe(jobId);
        expect(result?.userId).toBe(testUserId);
        expect(result?.documentId).toBe(testDocumentId);
      });

      test('should return null for non-existent job ID', async () => {
        const result = await getJobById({
          id: '550e8400-e29b-41d4-a716-446655440000',
        });

        expect(result).toBeNull();
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(getJobById({ id: 'invalid-uuid-format' })).rejects.toThrow(
          ChatSDKError,
        );
      });
    });

    describe('getJobsByUserId', () => {
      let jobIds: string[] = [];

      beforeEach(async () => {
        // Create multiple test jobs with slight delays to ensure ordering
        const job1 = await createJob(
          createMockJob(testUserId, testDocumentId, testDocumentCreatedAt),
        );
        await new Promise((resolve) => setTimeout(resolve, 10));

        const job2 = await createJob(
          createMockJob(testUserId, testDocumentId, testDocumentCreatedAt, {
            status: 'completed',
          }),
        );
        await new Promise((resolve) => setTimeout(resolve, 10));

        const job3 = await createJob(
          createMockJob(testUserId, testDocumentId, testDocumentCreatedAt, {
            runningStatus: 'running',
          }),
        );

        jobIds = [job1.id, job2.id, job3.id];
      });

      afterEach(async () => {
        if (jobIds.length > 0) {
          await deleteJobsByIds({ ids: jobIds });
          jobIds = [];
        }
      });

      test('should get all jobs for a user without pagination', async () => {
        const result = await getJobsByUserId({
          userId: testUserId,
          limit: 10,
        });

        expect(result.jobs).toHaveLength(3);
        expect(result.hasMore).toBe(false);
        expect(result.jobs[0].userId).toBe(testUserId);
        // Jobs should be ordered by createdAt DESC (latest first)
        expect(result.jobs[0].id).toBe(jobIds[2]); // Latest created
      });

      test('should limit results correctly', async () => {
        const result = await getJobsByUserId({
          userId: testUserId,
          limit: 2,
        });

        expect(result.jobs).toHaveLength(2);
        expect(result.hasMore).toBe(true);
      });

      test('should filter by status', async () => {
        const result = await getJobsByUserId({
          userId: testUserId,
          limit: 10,
          status: 'completed',
        });

        expect(result.jobs).toHaveLength(1);
        expect(result.jobs[0].status).toBe('completed');
        expect(result.jobs[0].id).toBe(jobIds[1]);
      });

      test('should filter by running status', async () => {
        const result = await getJobsByUserId({
          userId: testUserId,
          limit: 10,
          runningStatus: 'running',
        });

        expect(result.jobs).toHaveLength(1);
        expect(result.jobs[0].runningStatus).toBe('running');
        expect(result.jobs[0].id).toBe(jobIds[2]);
      });

      test('should handle pagination with endingBefore', async () => {
        // Get the first job (most recent)
        const firstResult = await getJobsByUserId({
          userId: testUserId,
          limit: 1,
        });

        // Get jobs before the first one
        const secondResult = await getJobsByUserId({
          userId: testUserId,
          limit: 10,
          endingBefore: firstResult.jobs[0].id,
        });

        expect(secondResult.jobs.length).toBeGreaterThan(0);
        expect(
          secondResult.jobs.every((job) => job.id !== firstResult.jobs[0].id),
        ).toBe(true);
      });

      test('should return empty result for non-existent user', async () => {
        const result = await getJobsByUserId({
          userId: '550e8400-e29b-41d4-a716-446655440000',
          limit: 10,
        });

        expect(result.jobs).toHaveLength(0);
        expect(result.hasMore).toBe(false);
      });

      test('should throw error for invalid endingBefore job id', async () => {
        await expect(
          getJobsByUserId({
            userId: testUserId,
            limit: 10,
            endingBefore: 'invalid-job-id',
          }),
        ).rejects.toThrow(ChatSDKError);
      });
    });

    describe('updateJob', () => {
      let jobId: string;

      beforeEach(async () => {
        const mockJob = createMockJob(
          testUserId,
          testDocumentId,
          testDocumentCreatedAt,
        );
        const createdJob = await createJob(mockJob);
        jobId = createdJob.id;
      });

      test('should update job successfully', async () => {
        const updates = {
          status: 'completed' as const,
          runningStatus: 'running' as const,
        };

        const result = await updateJob({ id: jobId, updates });

        expect(result.status).toBe('completed');
        expect(result.runningStatus).toBe('running');
        expect(result.updatedAt).toBeInstanceOf(Date);
      });

      test('should throw error for non-existent job', async () => {
        await expect(
          updateJob({
            id: '550e8400-e29b-41d4-a716-446655440000',
            updates: { status: 'completed' },
          }),
        ).rejects.toThrow(ChatSDKError);
        await expect(
          updateJob({
            id: '550e8400-e29b-41d4-a716-446655440000',
            updates: { status: 'completed' },
          }),
        ).rejects.toThrow(
          'An error occurred while executing a database query.',
        );
      });
    });

    describe('updateJobRunningStatus', () => {
      let jobId: string;

      beforeEach(async () => {
        const mockJob = createMockJob(
          testUserId,
          testDocumentId,
          testDocumentCreatedAt,
        );
        const createdJob = await createJob(mockJob);
        jobId = createdJob.id;
      });

      test('should update job running status successfully', async () => {
        const result = await updateJobRunningStatus({
          id: jobId,
          runningStatus: 'running',
        });

        expect(result.runningStatus).toBe('running');
        expect(result.updatedAt).toBeInstanceOf(Date);
      });

      test('should throw error for non-existent job', async () => {
        await expect(
          updateJobRunningStatus({
            id: '550e8400-e29b-41d4-a716-446655440000',
            runningStatus: 'running',
          }),
        ).rejects.toThrow(ChatSDKError);
      });
    });

    describe('deleteJob', () => {
      let jobId: string;

      beforeEach(async () => {
        const mockJob = createMockJob(
          testUserId,
          testDocumentId,
          testDocumentCreatedAt,
        );
        const createdJob = await createJob(mockJob);
        jobId = createdJob.id;
      });

      test('should delete a job by its ID', async () => {
        await deleteJob({ id: jobId });

        // Verify job was deleted
        const job = await getJobById({ id: jobId });
        expect(job).toBeNull();
      });

      test('should handle non-existent job ID gracefully', async () => {
        await expect(
          deleteJob({ id: '550e8400-e29b-41d4-a716-446655440000' }),
        ).resolves.toBeUndefined();
      });
    });

    describe('deleteJobsByIds', () => {
      let jobIds: string[] = [];

      beforeEach(async () => {
        // Create test jobs
        const jobs = await Promise.all([
          createJob(
            createMockJob(testUserId, testDocumentId, testDocumentCreatedAt),
          ),
          createJob(
            createMockJob(testUserId, testDocumentId, testDocumentCreatedAt),
          ),
          createJob(
            createMockJob(testUserId, testDocumentId, testDocumentCreatedAt),
          ),
        ]);
        jobIds = jobs.map((job) => job.id);
      });

      test('should delete jobs by their IDs', async () => {
        const idsToDelete = jobIds.slice(0, 2);

        await deleteJobsByIds({ ids: idsToDelete });

        // Verify jobs were deleted
        const remainingJob = await getJobById({ id: jobIds[2] });
        expect(remainingJob).toBeDefined();

        const deletedJob1 = await getJobById({ id: jobIds[0] });
        const deletedJob2 = await getJobById({ id: jobIds[1] });
        expect(deletedJob1).toBeNull();
        expect(deletedJob2).toBeNull();
      });

      test('should handle empty ids array gracefully', async () => {
        await expect(deleteJobsByIds({ ids: [] })).resolves.toBeUndefined();
      });

      test('should handle non-existent IDs gracefully', async () => {
        const mixedIds = [
          jobIds[0],
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
        ];

        await deleteJobsByIds({ ids: mixedIds });

        // Verify only the valid job was deleted
        const deletedJob = await getJobById({ id: jobIds[0] });
        expect(deletedJob).toBeNull();

        const remainingJob1 = await getJobById({ id: jobIds[1] });
        const remainingJob2 = await getJobById({ id: jobIds[2] });
        expect(remainingJob1).toBeDefined();
        expect(remainingJob2).toBeDefined();
      });
    });
  });

  describe('Job Result CRUD Operations', () => {
    let jobId: string;

    beforeEach(async () => {
      const mockJob = createMockJob(
        testUserId,
        testDocumentId,
        testDocumentCreatedAt,
      );
      const createdJob = await createJob(mockJob);
      jobId = createdJob.id;
    });

    describe('createJobResult', () => {
      test('should create a job result successfully', async () => {
        const mockJobResult = createMockJobResult(jobId);

        const result = await createJobResult(mockJobResult);

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.jobId).toBe(jobId);
        expect(result.status).toBe('pending');
        expect(result.result).toBeNull();
        expect(result.reason).toBeNull();
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
      });

      test('should create a job result with custom data', async () => {
        const mockJobResult = createMockJobResult(jobId, {
          status: 'completed',
          result: { data: 'test result' },
          reason: 'Test completion reason',
        });

        const result = await createJobResult(mockJobResult);

        expect(result.status).toBe('completed');
        expect(result.result).toEqual({ data: 'test result' });
        expect(result.reason).toBe('Test completion reason');
      });

      test('should throw ChatSDKError when database operation fails', async () => {
        const mockJobResult = createMockJobResult('invalid-job-id');

        await expect(createJobResult(mockJobResult)).rejects.toThrow(
          ChatSDKError,
        );
      });
    });

    describe('getJobResultById', () => {
      let jobResultId: string;

      beforeEach(async () => {
        const mockJobResult = createMockJobResult(jobId);
        const createdJobResult = await createJobResult(mockJobResult);
        jobResultId = createdJobResult.id;
      });

      test('should get job result by ID successfully', async () => {
        const result = await getJobResultById({ id: jobResultId });

        expect(result).toBeDefined();
        expect(result?.id).toBe(jobResultId);
        expect(result?.jobId).toBe(jobId);
      });

      test('should return null for non-existent job result ID', async () => {
        const result = await getJobResultById({
          id: '550e8400-e29b-41d4-a716-446655440000',
        });

        expect(result).toBeNull();
      });
    });

    describe('getJobResultsByJobId', () => {
      let jobResultIds: string[] = [];

      beforeEach(async () => {
        // Create multiple test job results
        const jobResult1 = await createJobResult(
          createMockJobResult(jobId, { reason: 'Step 1' }),
        );
        await new Promise((resolve) => setTimeout(resolve, 10));

        const jobResult2 = await createJobResult(
          createMockJobResult(jobId, {
            status: 'completed',
            reason: 'Step 2',
          }),
        );
        await new Promise((resolve) => setTimeout(resolve, 10));

        const jobResult3 = await createJobResult(
          createMockJobResult(jobId, {
            status: 'failed',
            reason: 'Step 3',
          }),
        );

        jobResultIds = [jobResult1.id, jobResult2.id, jobResult3.id];
      });

      afterEach(async () => {
        if (jobResultIds.length > 0) {
          await deleteJobResultsByIds({ ids: jobResultIds });
          jobResultIds = [];
        }
      });

      test('should get all job results for a job without pagination', async () => {
        const result = await getJobResultsByJobId({
          jobId,
          limit: 10,
        });

        expect(result.jobResults).toHaveLength(3);
        expect(result.hasMore).toBe(false);
        expect(result.jobResults[0].jobId).toBe(jobId);
      });

      test('should filter by status', async () => {
        const result = await getJobResultsByJobId({
          jobId,
          limit: 10,
          status: 'completed',
        });

        expect(result.jobResults).toHaveLength(1);
        expect(result.jobResults[0].status).toBe('completed');
      });

      test('should limit results correctly', async () => {
        const result = await getJobResultsByJobId({
          jobId,
          limit: 2,
        });

        expect(result.jobResults).toHaveLength(2);
        expect(result.hasMore).toBe(true);
      });
    });

    describe('getAllJobResultsByJobId', () => {
      let jobResultIds: string[] = [];

      beforeEach(async () => {
        // Create multiple test job results
        const results = await Promise.all([
          createJobResult(createMockJobResult(jobId, { status: 'completed' })),
          createJobResult(createMockJobResult(jobId, { status: 'pending' })),
          createJobResult(createMockJobResult(jobId, { status: 'failed' })),
        ]);
        jobResultIds = results.map((result) => result.id);
      });

      afterEach(async () => {
        if (jobResultIds.length > 0) {
          await deleteJobResultsByIds({ ids: jobResultIds });
          jobResultIds = [];
        }
      });

      test('should get all job results without pagination', async () => {
        const results = await getAllJobResultsByJobId({ jobId });

        expect(results).toHaveLength(3);
        expect(results.every((result) => result.jobId === jobId)).toBe(true);
      });

      test('should filter by status', async () => {
        const completedResults = await getAllJobResultsByJobId({
          jobId,
          status: 'completed',
        });

        expect(completedResults).toHaveLength(1);
        expect(completedResults[0].status).toBe('completed');
      });
    });

    describe('updateJobResult', () => {
      let jobResultId: string;

      beforeEach(async () => {
        const mockJobResult = createMockJobResult(jobId);
        const createdJobResult = await createJobResult(mockJobResult);
        jobResultId = createdJobResult.id;
      });

      test('should update job result successfully', async () => {
        const updates = {
          status: 'completed' as const,
          result: { data: 'completed result' },
          reason: 'Job completed successfully',
        };

        const result = await updateJobResult({ id: jobResultId, updates });

        expect(result.status).toBe('completed');
        expect(result.result).toEqual({ data: 'completed result' });
        expect(result.reason).toBe('Job completed successfully');
        expect(result.updatedAt).toBeInstanceOf(Date);
      });

      test('should throw error for non-existent job result', async () => {
        await expect(
          updateJobResult({
            id: '550e8400-e29b-41d4-a716-446655440000',
            updates: { status: 'completed' },
          }),
        ).rejects.toThrow(ChatSDKError);
      });
    });

    describe('deleteJobResult and deleteJobResultsByIds', () => {
      let jobResultIds: string[] = [];

      beforeEach(async () => {
        // Create test job results
        const results = await Promise.all([
          createJobResult(createMockJobResult(jobId)),
          createJobResult(createMockJobResult(jobId)),
          createJobResult(createMockJobResult(jobId)),
        ]);
        jobResultIds = results.map((result) => result.id);
      });

      test('should delete a job result by ID', async () => {
        await deleteJobResult({ id: jobResultIds[0] });

        const deletedResult = await getJobResultById({ id: jobResultIds[0] });
        expect(deletedResult).toBeNull();
      });

      test('should delete multiple job results by IDs', async () => {
        const idsToDelete = jobResultIds.slice(0, 2);

        await deleteJobResultsByIds({ ids: idsToDelete });

        const remainingResult = await getJobResultById({
          id: jobResultIds[2],
        });
        expect(remainingResult).toBeDefined();

        const deletedResult1 = await getJobResultById({ id: jobResultIds[0] });
        const deletedResult2 = await getJobResultById({ id: jobResultIds[1] });
        expect(deletedResult1).toBeNull();
        expect(deletedResult2).toBeNull();
      });

      test('should handle empty ids array gracefully', async () => {
        await expect(
          deleteJobResultsByIds({ ids: [] }),
        ).resolves.toBeUndefined();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      const mockJob = createMockJob(
        'invalid-user-id',
        testDocumentId,
        testDocumentCreatedAt,
      );

      await expect(createJob(mockJob)).rejects.toThrow(ChatSDKError);
    });

    test('should throw appropriate error types', async () => {
      try {
        await createJob(
          createMockJob(
            'invalid-user-id',
            testDocumentId,
            testDocumentCreatedAt,
          ),
        );
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        const chatSDKError = error as ChatSDKError;
        const errorCode = `${chatSDKError.type}:${chatSDKError.surface}`;
        expect(errorCode).toBe('bad_request:database');
      }
    });
  });

  describe('Data Integrity', () => {
    test('should maintain data consistency across job operations', async () => {
      // Create a job
      const mockJob = createMockJob(
        testUserId,
        testDocumentId,
        testDocumentCreatedAt,
      );
      const createdJob = await createJob(mockJob);

      // Retrieve by ID
      const jobById = await getJobById({ id: createdJob.id });
      expect(jobById).toEqual(createdJob);

      // Retrieve by user ID
      const userJobs = await getJobsByUserId({ userId: testUserId, limit: 10 });
      expect(userJobs.jobs).toHaveLength(1);
      expect(userJobs.jobs[0].id).toBe(createdJob.id);

      // Update and verify consistency
      const updatedJob = await updateJob({
        id: createdJob.id,
        updates: { status: 'completed' },
      });
      expect(updatedJob.status).toBe('completed');

      // Delete and verify consistency
      await deleteJob({ id: createdJob.id });
      const afterDeletion = await getJobById({ id: createdJob.id });
      expect(afterDeletion).toBeNull();
    });

    test('should maintain data consistency across job result operations', async () => {
      // Create a job first
      const mockJob = createMockJob(
        testUserId,
        testDocumentId,
        testDocumentCreatedAt,
      );
      const createdJob = await createJob(mockJob);

      // Create a job result
      const mockJobResult = createMockJobResult(createdJob.id);
      const createdJobResult = await createJobResult(mockJobResult);

      // Verify consistency across different query methods
      const resultById = await getJobResultById({ id: createdJobResult.id });
      expect(resultById).toEqual(createdJobResult);

      const resultsByJobId = await getJobResultsByJobId({
        jobId: createdJob.id,
        limit: 10,
      });
      expect(resultsByJobId.jobResults).toHaveLength(1);
      expect(resultsByJobId.jobResults[0].id).toBe(createdJobResult.id);

      const allResults = await getAllJobResultsByJobId({
        jobId: createdJob.id,
      });
      expect(allResults).toHaveLength(1);
      expect(allResults[0].id).toBe(createdJobResult.id);
    });

    test('should handle concurrent operations safely', async () => {
      const mockJobs = Array.from({ length: 5 }, () =>
        createMockJob(testUserId, testDocumentId, testDocumentCreatedAt),
      );

      // Create jobs concurrently
      const createdJobs = await Promise.all(
        mockJobs.map((job) => createJob(job)),
      );

      expect(createdJobs).toHaveLength(5);
      expect(new Set(createdJobs.map((job) => job.id)).size).toBe(5); // All unique IDs

      // Create job results concurrently
      const mockJobResults = createdJobs.map((job) =>
        createMockJobResult(job.id),
      );
      const createdJobResults = await Promise.all(
        mockJobResults.map((jobResult) => createJobResult(jobResult)),
      );

      expect(createdJobResults).toHaveLength(5);

      // Delete some jobs concurrently
      const idsToDelete = createdJobs.slice(0, 3).map((job) => job.id);
      await Promise.all([
        deleteJob({ id: idsToDelete[0] }),
        deleteJob({ id: idsToDelete[1] }),
        deleteJob({ id: idsToDelete[2] }),
      ]);

      // Verify correct number remaining
      const remainingJobs = await getJobsByUserId({
        userId: testUserId,
        limit: 10,
      });
      expect(remainingJobs.jobs).toHaveLength(2);
    });
  });
});
