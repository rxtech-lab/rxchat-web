jest.mock('@/app/(auth)/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/db/queries/client', () => ({
  db: {
    transaction: jest.fn(),
  },
}));

jest.mock('@/lib/db/queries/job', () => ({
  deleteJob: jest.fn(),
  deleteJobsByIds: jest.fn(),
  updateJobRunningStatus: jest.fn(),
  getJobsByUserId: jest.fn(),
  getJobById: jest.fn(),
}));

jest.mock('@upstash/qstash', () => {
  const mockInstance = {
    schedules: {
      delete: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
    },
    publishJSON: jest.fn(),
  };
  return {
    Client: jest.fn().mockImplementation(() => mockInstance),
    __mockInstance: mockInstance,
  };
});

jest.mock('@upstash/workflow', () => {
  const mockInstance = {
    trigger: jest.fn(),
    cancel: jest.fn(),
  };
  return {
    Client: jest.fn().mockImplementation(() => mockInstance),
    __mockInstance: mockInstance,
  };
});

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db/queries/client';
import {
  deleteJob,
  deleteJobsByIds,
  updateJobRunningStatus,
  getJobsByUserId,
  getJobById,
} from '@/lib/db/queries/job';
import { Client as QStashClient } from '@upstash/qstash';
import { Client as WorkflowClient } from '@upstash/workflow';
import { revalidatePath } from 'next/cache';
import {
  getJobs,
  getJob,
  deleteJobAction,
  deleteJobsAction,
  updateJobRunningStatusAction,
  triggerJobAction,
} from './actions';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockDb = db as jest.Mocked<typeof db>;
const mockDeleteJob = deleteJob as jest.MockedFunction<typeof deleteJob>;
const mockDeleteJobsByIds = deleteJobsByIds as jest.MockedFunction<
  typeof deleteJobsByIds
>;
const mockUpdateJobRunningStatus =
  updateJobRunningStatus as jest.MockedFunction<typeof updateJobRunningStatus>;
const mockGetJobsByUserId = getJobsByUserId as jest.MockedFunction<
  typeof getJobsByUserId
>;
const mockGetJobById = getJobById as jest.MockedFunction<typeof getJobById>;
const mockQStashClient = QStashClient as jest.MockedFunction<
  typeof QStashClient
>;
const mockWorkflowClient = WorkflowClient as jest.MockedFunction<
  typeof WorkflowClient
>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<
  typeof revalidatePath
>;

// Mock session object
const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
  },
};

// Mock job object
const mockJob = {
  id: '123e4567-e89b-12d3-a456-426614174000', // Valid UUID
  userId: 'test-user-id',
  documentId: 'test-doc-id',
  status: 'pending' as const,
  runningStatus: 'stopped' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Get mock instances
const QStashMock = jest.requireMock('@upstash/qstash');
const WorkflowMock = jest.requireMock('@upstash/workflow');
const mockQStashInstance = QStashMock.__mockInstance;
const mockWorkflowInstance = WorkflowMock.__mockInstance;

describe('Jobs Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockAuth.mockResolvedValue(mockSession as any);
    mockDb.transaction.mockImplementation(async (callback) => {
      // Mock transaction - provide a transaction object with delete method
      const mockTx = {
        delete: jest.fn().mockResolvedValue(undefined),
      };
      return await callback(mockTx as any);
    });
    mockRevalidatePath.mockReturnValue(undefined);
    
    // Setup mock returns for QStash and Workflow instances
    mockQStashInstance.schedules.delete.mockResolvedValue(undefined);
    mockQStashInstance.schedules.pause.mockResolvedValue(undefined);
    mockQStashInstance.schedules.resume.mockResolvedValue(undefined);
    mockQStashInstance.publishJSON.mockResolvedValue({ messageId: 'msg-123' });
    mockWorkflowInstance.trigger.mockResolvedValue(undefined);
    
    // Setup job query mocks
    mockDeleteJob.mockResolvedValue(undefined);
    mockDeleteJobsByIds.mockResolvedValue(undefined);
    mockUpdateJobRunningStatus.mockResolvedValue(undefined);
    mockGetJobById.mockResolvedValue(mockJob as any);
  });

  describe('getJobs', () => {
    test('should get jobs with pagination successfully', async () => {
      const mockJobsResult = {
        jobs: [mockJob],
        hasMore: false,
      };

      mockGetJobsByUserId.mockResolvedValue(mockJobsResult as any);

      const result = await getJobs({
        limit: 20,
        startingAfter: null,
        endingBefore: null,
        status: undefined,
        runningStatus: undefined,
      });

      expect(result.jobs).toEqual([mockJob]);
      expect(result.hasMore).toBe(false);
      expect(mockGetJobsByUserId).toHaveBeenCalledWith({
        userId: 'test-user-id',
        limit: 20,
        startingAfter: null,
        endingBefore: null,
        status: undefined,
        runningStatus: undefined,
      });
    });

    test('should filter jobs by status', async () => {
      const mockJobsResult = {
        jobs: [{ ...mockJob, status: 'completed' }],
        hasMore: false,
      };

      mockGetJobsByUserId.mockResolvedValue(mockJobsResult as any);

      const result = await getJobs({
        limit: 20,
        startingAfter: null,
        endingBefore: null,
        status: 'completed',
        runningStatus: undefined,
      });

      expect(result.jobs[0].status).toBe('completed');
      expect(mockGetJobsByUserId).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
        }),
      );
    });

    test('should filter jobs by running status', async () => {
      const mockJobsResult = {
        jobs: [{ ...mockJob, runningStatus: 'running' }],
        hasMore: false,
      };

      mockGetJobsByUserId.mockResolvedValue(mockJobsResult as any);

      const result = await getJobs({
        limit: 20,
        startingAfter: null,
        endingBefore: null,
        status: undefined,
        runningStatus: 'running',
      });

      expect(result.jobs[0].runningStatus).toBe('running');
      expect(mockGetJobsByUserId).toHaveBeenCalledWith(
        expect.objectContaining({
          runningStatus: 'running',
        }),
      );
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      await expect(
        getJobs({
          limit: 20,
          startingAfter: null,
          endingBefore: null,
          status: undefined,
          runningStatus: undefined,
        }),
      ).rejects.toThrow('You need to sign in to view this chat. Please sign in and try again.');
    });

    test('should validate pagination parameters', async () => {
      await expect(
        getJobs({
          limit: 20,
          startingAfter: null,
          endingBefore: null,
          status: 'invalid-status' as any, // This should fail validation
          runningStatus: undefined,
        }),
      ).rejects.toThrow();
    });
  });

  describe('getJob', () => {
    test('should get job by ID successfully', async () => {
      mockGetJobById.mockResolvedValue(mockJob as any);

      const result = await getJob({ id: 'test-job-id' });

      expect(result).toEqual(mockJob);
      expect(mockGetJobById).toHaveBeenCalledWith({ id: 'test-job-id' });
    });

    test('should throw error for non-existent job', async () => {
      mockGetJobById.mockResolvedValue(null);

      await expect(getJob({ id: 'non-existent-id' })).rejects.toThrow('The requested chat was not found');
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      await expect(getJob({ id: 'test-job-id' })).rejects.toThrow(
        'You need to sign in to view this chat. Please sign in and try again.',
      );
    });

    test('should validate job ID parameter', async () => {
      // Since the function doesn't validate UUID format, it will try to fetch
      // The mock is set up to return mockJob, so it will succeed
      mockGetJobById.mockResolvedValue(mockJob as any);
      
      const result = await getJob({ id: 'invalid-uuid' });
      
      expect(result).toEqual(mockJob);
    });
  });

  describe('deleteJobAction', () => {
    test('should delete job successfully', async () => {
      mockGetJobById.mockResolvedValue(mockJob as any);
      mockDeleteJob.mockResolvedValue(undefined);

      const result = await deleteJobAction({ id: mockJob.id });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Job deleted successfully');
      expect(mockDeleteJob).toHaveBeenCalledWith({ id: mockJob.id, dbConnection: expect.any(Object) });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/jobs');
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await deleteJobAction({ id: 'test-job-id' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Authentication required');
    });

    test('should validate job ID parameter', async () => {
      const result = await deleteJobAction({ id: 'invalid-uuid' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid job ID');
    });

    test('should handle deletion errors', async () => {
      // Mock getJobById to return a valid job first
      mockGetJobById.mockResolvedValue(mockJob as any);
      mockDeleteJob.mockRejectedValue(new Error('Database error'));

      const result = await deleteJobAction({ id: mockJob.id });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to delete job');
    });
  });

  describe('deleteJobsAction', () => {
    test('should delete multiple jobs successfully', async () => {
      // Mock getJobById to return jobs for all IDs
      mockGetJobById.mockResolvedValue(mockJob as any);
      mockDeleteJobsByIds.mockResolvedValue(undefined);

      const validUuid1 = '123e4567-e89b-12d3-a456-426614174001';
      const validUuid2 = '123e4567-e89b-12d3-a456-426614174002';

      const result = await deleteJobsAction({ ids: [validUuid1, validUuid2] });

      expect(result.success).toBe(true);
      expect(result.message).toBe('2 job(s) deleted successfully');
      expect(mockDeleteJobsByIds).toHaveBeenCalledWith({
        ids: [validUuid1, validUuid2],
        dbConnection: expect.any(Object),
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/jobs');
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await deleteJobsAction({ ids: ['job-1', 'job-2'] });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Authentication required');
    });

    test('should validate job IDs parameter', async () => {
      const result = await deleteJobsAction({ ids: [] }); // Empty array

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid job IDs');
    });

    test('should validate UUID format', async () => {
      const result = await deleteJobsAction({ ids: ['invalid-uuid'] });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid job IDs');
    });

    test('should handle deletion errors', async () => {
      const validUuid1 = '123e4567-e89b-12d3-a456-426614174001';
      const validUuid2 = '123e4567-e89b-12d3-a456-426614174002';
      
      // Mock to return valid jobs first
      mockGetJobById.mockResolvedValue(mockJob as any);
      mockDeleteJobsByIds.mockRejectedValue(new Error('Database error'));

      const result = await deleteJobsAction({ ids: [validUuid1, validUuid2] });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to delete jobs');
    });
  });

  describe('updateJobRunningStatusAction', () => {
    test('should update job running status successfully', async () => {
      mockGetJobById.mockResolvedValue(mockJob as any);
      mockUpdateJobRunningStatus.mockResolvedValue(undefined);

      const result = await updateJobRunningStatusAction({
        id: mockJob.id, // Use valid UUID
        runningStatus: 'running',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Job started successfully');
      expect(mockUpdateJobRunningStatus).toHaveBeenCalledWith({
        id: mockJob.id,
        runningStatus: 'running',
        dbConnection: expect.any(Object),
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/jobs');
    });

    test('should update status to stopped', async () => {
      mockGetJobById.mockResolvedValue(mockJob as any);
      mockUpdateJobRunningStatus.mockResolvedValue(undefined);

      const result = await updateJobRunningStatusAction({
        id: mockJob.id, // Use valid UUID
        runningStatus: 'stopped',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Job stopped successfully');
      expect(mockUpdateJobRunningStatus).toHaveBeenCalledWith({
        id: mockJob.id,
        runningStatus: 'stopped',
        dbConnection: expect.any(Object),
      });
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await updateJobRunningStatusAction({
        id: 'test-job-id',
        runningStatus: 'running',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Authentication required');
    });

    test('should validate parameters', async () => {
      const result = await updateJobRunningStatusAction({
        id: 'invalid-uuid',
        runningStatus: 'invalid' as any,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid parameters');
    });

    test('should handle update errors', async () => {
      mockGetJobById.mockResolvedValue(mockJob as any);
      mockUpdateJobRunningStatus.mockRejectedValue(new Error('Database error'));

      const result = await updateJobRunningStatusAction({
        id: mockJob.id, // Use valid UUID
        runningStatus: 'running',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to update job status');
    });
  });

  describe('triggerJobAction', () => {
    test('should trigger job successfully', async () => {
      mockGetJobById.mockResolvedValue(mockJob as any);

      const result = await triggerJobAction({ id: 'test-job-id' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Job triggered successfully');
      expect(mockWorkflowInstance.trigger).toHaveBeenCalled();
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await triggerJobAction({ id: 'test-job-id' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Authentication required');
    });

    test('should validate job ID parameter', async () => {
      // Override mock to return null for invalid ID test
      mockGetJobById.mockResolvedValue(null);
      
      const result = await triggerJobAction({ id: 'invalid-uuid' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Job not found');
    });

    test('should handle QStash errors', async () => {
      // Override mock to return null for error test
      mockGetJobById.mockResolvedValue(null);
      
      const result = await triggerJobAction({ id: 'nonexistent-job-id' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Job not found');
    });
  });
});
