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

jest.mock('@upstash/qstash', () => ({
  Client: jest.fn(),
}));

jest.mock('@upstash/workflow', () => ({
  Client: jest.fn(),
}));

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

// Mock QStash client instance
const mockQStashInstance = {
  publishJSON: jest.fn(),
  cancel: jest.fn(),
  schedules: {
    delete: jest.fn(),
  },
};

// Mock Workflow client instance
const mockWorkflowInstance = {
  cancel: jest.fn(),
  trigger: jest.fn(),
};

describe('Jobs Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockAuth.mockResolvedValue(mockSession as any);
    mockDb.transaction.mockImplementation(async (callback) => {
      // Mock transaction - just call the callback with a mock transaction object
      return await callback({} as any);
    });
    mockQStashClient.mockReturnValue(mockQStashInstance as any);
    mockWorkflowClient.mockReturnValue(mockWorkflowInstance as any);
    mockRevalidatePath.mockReturnValue(undefined);
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

    test('should return null for non-existent job', async () => {
      mockGetJobById.mockResolvedValue(null);

      const result = await getJob({ id: 'non-existent-id' });

      expect(result).toBeNull();
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      await expect(getJob({ id: 'test-job-id' })).rejects.toThrow(
        'You need to sign in to view this chat. Please sign in and try again.',
      );
    });

    test('should validate job ID parameter', async () => {
      await expect(getJob({ id: 'invalid-uuid' })).rejects.toThrow();
    });
  });

  describe('deleteJobAction', () => {
    test('should delete job successfully', async () => {
      mockGetJobById.mockResolvedValue(mockJob as any);
      mockDeleteJob.mockResolvedValue(undefined);

      const result = await deleteJobAction({ id: mockJob.id });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Job deleted successfully');
      expect(mockDeleteJob).toHaveBeenCalledWith({ id: mockJob.id });
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
      mockDeleteJob.mockRejectedValue(new Error('Database error'));

      const result = await deleteJobAction({ id: 'test-job-id' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to delete job');
    });
  });

  describe('deleteJobsAction', () => {
    test('should delete multiple jobs successfully', async () => {
      // Mock getJobById to return jobs for all IDs
      mockGetJobById.mockResolvedValue(mockJob as any);
      mockDeleteJobsByIds.mockResolvedValue(undefined);

      const result = await deleteJobsAction({ ids: ['job-1', 'job-2'] });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Jobs deleted successfully');
      expect(mockDeleteJobsByIds).toHaveBeenCalledWith({
        ids: ['job-1', 'job-2'],
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
      mockDeleteJobsByIds.mockRejectedValue(new Error('Database error'));

      const result = await deleteJobsAction({ ids: ['job-1', 'job-2'] });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to delete jobs');
    });
  });

  describe('updateJobRunningStatusAction', () => {
    test('should update job running status successfully', async () => {
      mockGetJobById.mockResolvedValue(mockJob as any);
      mockUpdateJobRunningStatus.mockResolvedValue(undefined);

      const result = await updateJobRunningStatusAction({
        id: 'test-job-id',
        runningStatus: 'running',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Job status updated successfully');
      expect(mockUpdateJobRunningStatus).toHaveBeenCalledWith({
        id: 'test-job-id',
        runningStatus: 'running',
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/jobs');
    });

    test('should update status to stopped', async () => {
      mockGetJobById.mockResolvedValue(mockJob as any);
      mockUpdateJobRunningStatus.mockResolvedValue(undefined);

      const result = await updateJobRunningStatusAction({
        id: 'test-job-id',
        runningStatus: 'stopped',
      });

      expect(result.success).toBe(true);
      expect(mockUpdateJobRunningStatus).toHaveBeenCalledWith({
        id: 'test-job-id',
        runningStatus: 'stopped',
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
      mockUpdateJobRunningStatus.mockRejectedValue(new Error('Database error'));

      const result = await updateJobRunningStatusAction({
        id: 'test-job-id',
        runningStatus: 'running',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to update job status');
    });
  });

  describe('triggerJobAction', () => {
    test('should trigger job successfully', async () => {
      mockGetJobById.mockResolvedValue(mockJob as any);
      mockQStashInstance.publishJSON.mockResolvedValue({
        messageId: 'msg-123',
      });

      const result = await triggerJobAction({ id: 'test-job-id' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Job triggered successfully');
      expect(mockQStashInstance.publishJSON).toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith('/jobs');
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await triggerJobAction({ id: 'test-job-id' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Authentication required');
    });

    test('should validate job ID parameter', async () => {
      const result = await triggerJobAction({ id: 'invalid-uuid' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Job not found');
    });

    test('should handle QStash errors', async () => {
      const result = await triggerJobAction({ id: 'nonexistent-job-id' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Job not found');
    });
  });
});
