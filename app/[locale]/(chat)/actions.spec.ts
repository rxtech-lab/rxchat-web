jest.mock('@/app/(auth)/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/agent/prompt-runner/runner', () => ({
  createPromptRunner: jest.fn(),
}));

jest.mock('@/lib/ai/mcp', () => ({
  createMCPClient: jest.fn(),
}));

jest.mock('@/lib/db/queries/client', () => ({
  db: {
    transaction: jest.fn(),
  },
}));

jest.mock('@/lib/db/queries/job', () => ({
  createJob: jest.fn(),
  getJobByDocumentId: jest.fn(),
  updateJobRunningStatus: jest.fn(),
}));

jest.mock('@/lib/db/queries/queries', () => ({
  deleteMessagesByChatIdAfterTimestamp: jest.fn(),
  getDocumentById: jest.fn(),
  getMessageById: jest.fn(),
  selectPromptById: jest.fn(),
  updateChatVisiblityById: jest.fn(),
}));

jest.mock('@/lib/db/queries/user', () => ({
  getUserContext: jest.fn(),
}));

jest.mock('@/lib/workflow/engine', () => ({
  createJSExecutionEngine: jest.fn(),
}));

jest.mock('@/lib/workflow/engine/testToolExecutionEngine', () => ({
  createTestToolExecutionEngine: jest.fn(),
}));

jest.mock('@/lib/workflow/utils', () => ({
  getWorkflowWebhookUrl: jest.fn(),
}));

jest.mock('@/lib/workflow/workflow-engine', () => ({
  WorkflowEngine: jest.fn(),
}));

jest.mock('@upstash/qstash', () => ({
  Client: jest.fn(),
}));

jest.mock('ai', () => ({
  generateText: jest.fn(),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

import { auth } from '@/app/(auth)/auth';
import { createPromptRunner } from '@/lib/agent/prompt-runner/runner';
import { createMCPClient } from '@/lib/ai/mcp';
import { db } from '@/lib/db/queries/client';
import {
  createJob,
  getJobByDocumentId,
  updateJobRunningStatus,
} from '@/lib/db/queries/job';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getDocumentById,
  getMessageById,
  selectPromptById,
  updateChatVisiblityById,
} from '@/lib/db/queries/queries';
import { getUserContext } from '@/lib/db/queries/user';
import { createJSExecutionEngine } from '@/lib/workflow/engine';
import { createTestToolExecutionEngine } from '@/lib/workflow/engine/testToolExecutionEngine';
import { getWorkflowWebhookUrl } from '@/lib/workflow/utils';
import { WorkflowEngine } from '@/lib/workflow/workflow-engine';
import { Client } from '@upstash/qstash';
import { generateText } from 'ai';
import { cookies } from 'next/headers';
import {
  saveChatModelAsCookie,
  generateTitleFromUserMessage,
  deleteTrailingMessages,
  updateChatVisibility,
  getMCPTools,
  testPrompt,
  selectPrompt,
  createWorkflowJob,
} from './actions';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockCreatePromptRunner = createPromptRunner as jest.MockedFunction<
  typeof createPromptRunner
>;
const mockCreateMCPClient = createMCPClient as jest.MockedFunction<
  typeof createMCPClient
>;
const mockCreateJob = createJob as jest.MockedFunction<typeof createJob>;
const mockGetJobByDocumentId = getJobByDocumentId as jest.MockedFunction<
  typeof getJobByDocumentId
>;
const mockUpdateJobRunningStatus =
  updateJobRunningStatus as jest.MockedFunction<typeof updateJobRunningStatus>;
const mockDeleteMessagesByChatIdAfterTimestamp =
  deleteMessagesByChatIdAfterTimestamp as jest.MockedFunction<
    typeof deleteMessagesByChatIdAfterTimestamp
  >;
const mockGetDocumentById = getDocumentById as jest.MockedFunction<
  typeof getDocumentById
>;
const mockGetMessageById = getMessageById as jest.MockedFunction<
  typeof getMessageById
>;
const mockSelectPromptById = selectPromptById as jest.MockedFunction<
  typeof selectPromptById
>;
const mockUpdateChatVisiblityById =
  updateChatVisiblityById as jest.MockedFunction<
    typeof updateChatVisiblityById
  >;
const mockGetUserContext = getUserContext as jest.MockedFunction<
  typeof getUserContext
>;
const mockCreateJSExecutionEngine =
  createJSExecutionEngine as jest.MockedFunction<
    typeof createJSExecutionEngine
  >;
const mockCreateTestToolExecutionEngine =
  createTestToolExecutionEngine as jest.MockedFunction<
    typeof createTestToolExecutionEngine
  >;
const mockGetWorkflowWebhookUrl = getWorkflowWebhookUrl as jest.MockedFunction<
  typeof getWorkflowWebhookUrl
>;
const mockWorkflowEngine = WorkflowEngine as jest.MockedFunction<
  //@ts-expect-error
  typeof WorkflowEngine
>;
//@ts-expect-error
const mockQStashClient = Client as jest.MockedFunction<typeof Client>;
const mockGenerateText = generateText as jest.MockedFunction<
  typeof generateText
>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

// Mock session object
const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
  },
};

// Mock cookies store
const mockCookieStore = {
  set: jest.fn(),
  get: jest.fn(),
};

// Mock MCP client
const mockMCPClient = {
  tools: jest.fn(),
};

// Mock prompt runner
const mockPromptRunnerInstance = {
  run: jest.fn(),
};

// Mock execution engine
const mockExecutionEngine = {
  execute: jest.fn(),
};

// Mock WorkflowEngine instance
const mockWorkflowEngineInstance = {
  execute: jest.fn(),
};

// Mock QStash workflow client instance
const mockQStashWorkflowClient = {
  schedules: {
    delete: jest.fn(),
    create: jest.fn(),
  },
};

describe('Chat Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    //@ts-expect-error
    mockAuth.mockResolvedValue(mockSession as any);
    mockCookies.mockResolvedValue(mockCookieStore as any);
    mockCreateMCPClient.mockResolvedValue(mockMCPClient as any);
    mockCreatePromptRunner.mockReturnValue(mockPromptRunnerInstance as any);
    mockCreateJSExecutionEngine.mockReturnValue(mockExecutionEngine as any);
    mockCreateTestToolExecutionEngine.mockReturnValue(
      mockExecutionEngine as any,
    );
    mockGetWorkflowWebhookUrl.mockReturnValue(
      new URL('https://test-webhook-url.com'),
    );

    // Mock WorkflowEngine constructor
    mockWorkflowEngine.mockImplementation(
      () => mockWorkflowEngineInstance as any,
    );

    // Mock QStash Client constructor
    mockQStashClient.mockImplementation(() => mockQStashWorkflowClient as any);

    // Setup missing function mocks
    mockGetUserContext.mockResolvedValue({ userId: 'test-user-id' } as any);
    //@ts-expect-error
    mockUpdateJobRunningStatus.mockResolvedValue(null);

    // Mock database transaction
    (db.transaction as jest.Mock).mockImplementation((fn) => fn(db));
  });

  describe('saveChatModelAsCookie', () => {
    test('should save chat model and provider as cookies', async () => {
      await saveChatModelAsCookie('gpt-4', 'openAI');

      expect(mockCookieStore.set).toHaveBeenCalledWith('chat-model', 'gpt-4');
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'chat-model-provider',
        'openAI',
      );
    });

    test('should handle different model providers', async () => {
      await saveChatModelAsCookie('claude-3', 'anthropic');

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'chat-model',
        'claude-3',
      );
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'chat-model-provider',
        'anthropic',
      );
    });
  });

  describe('generateTitleFromUserMessage', () => {
    test('should generate title from user message', async () => {
      const mockMessage = {
        id: 'test-message-id',
        role: 'user' as const,
        content: 'Hello, how are you?',
      } as any;

      const mockTitleModel = {
        provider: 'openai',
        modelId: 'gpt-3.5-turbo',
      } as any;

      mockGenerateText.mockResolvedValue({
        text: 'Generated Title',
      } as any);

      const result = await generateTitleFromUserMessage({
        message: mockMessage,
        titleModel: mockTitleModel,
      });

      expect(result).toBe('Generated Title');
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: mockTitleModel,
        prompt: expect.stringContaining('Hello, how are you?'),
        system: expect.stringContaining('generate a short title'),
      });
    });

    test('should handle generation errors gracefully', async () => {
      const mockMessage = {
        id: 'test-message-id',
        role: 'user' as const,
        content: 'Test message',
      } as any;

      const mockTitleModel = {
        provider: 'openai',
        modelId: 'gpt-3.5-turbo',
      } as any;

      mockGenerateText.mockRejectedValue(new Error('Generation failed'));

      await expect(
        generateTitleFromUserMessage({
          message: mockMessage,
          titleModel: mockTitleModel,
        }),
      ).rejects.toThrow('Generation failed');
    });
  });

  describe('deleteTrailingMessages', () => {
    test('should delete trailing messages after specified message', async () => {
      const mockMessage = {
        id: 'test-message-id',
        chatId: 'test-chat-id',
        createdAt: new Date(),
      };

      mockGetMessageById.mockResolvedValue([mockMessage] as any);
      mockDeleteMessagesByChatIdAfterTimestamp.mockResolvedValue(undefined);

      await deleteTrailingMessages({ id: 'test-message-id' });

      expect(mockGetMessageById).toHaveBeenCalledWith({
        id: 'test-message-id',
      });
      expect(mockDeleteMessagesByChatIdAfterTimestamp).toHaveBeenCalledWith({
        chatId: 'test-chat-id',
        timestamp: mockMessage.createdAt,
      });
    });

    test('should handle message not found', async () => {
      mockGetMessageById.mockResolvedValue([]);

      await expect(
        deleteTrailingMessages({ id: 'non-existent-id' }),
      ).rejects.toThrow();
    });
  });

  describe('updateChatVisibility', () => {
    test('should update chat visibility', async () => {
      //@ts-expect-error
      mockUpdateChatVisiblityById.mockResolvedValue(undefined);

      await updateChatVisibility({
        chatId: 'test-chat-id',
        visibility: 'public',
      });

      expect(mockUpdateChatVisiblityById).toHaveBeenCalledWith({
        chatId: 'test-chat-id',
        visibility: 'public',
      });
    });

    test('should handle private visibility', async () => {
      //@ts-expect-error
      mockUpdateChatVisiblityById.mockResolvedValue(undefined);

      await updateChatVisibility({
        chatId: 'test-chat-id',
        visibility: 'private',
      });

      expect(mockUpdateChatVisiblityById).toHaveBeenCalledWith({
        chatId: 'test-chat-id',
        visibility: 'private',
      });
    });
  });

  describe('getMCPTools', () => {
    test('should return empty array in test environment', async () => {
      // Test environment is detected by the isTestEnvironment constant
      const result = await getMCPTools();

      expect(result).toEqual([]);
      expect(mockCreateMCPClient).not.toHaveBeenCalled();
    });

    test('should return MCP tools in non-test environment', async () => {
      // Temporarily override test environment check
      const originalIsTestEnvironment =
        require('@/lib/constants').isTestEnvironment;
      require('@/lib/constants').isTestEnvironment = false;

      const mockTools = {
        tool1: { description: 'Tool 1 description' },
        tool2: { description: 'Tool 2 description' },
      };

      mockMCPClient.tools.mockResolvedValue(mockTools);

      const result = await getMCPTools();

      expect(result).toEqual([
        { title: 'tool1', description: 'Tool 1 description' },
        { title: 'tool2', description: 'Tool 2 description' },
      ]);
      expect(mockCreateMCPClient).toHaveBeenCalled();
      expect(mockMCPClient.tools).toHaveBeenCalled();

      // Restore original value
      require('@/lib/constants').isTestEnvironment = originalIsTestEnvironment;
    });
  });

  describe('testPrompt', () => {
    test('should execute prompt code successfully', async () => {
      const testCode = 'console.log("Hello, World!");';
      const expectedResult = 'Hello, World!';

      //@ts-expect-error
      mockCreatePromptRunner.mockReturnValue(expectedResult);

      const result = await testPrompt(testCode);

      expect(result.result).toBe(expectedResult);
      expect(result.error).toBeUndefined();
      expect(mockCreatePromptRunner).toHaveBeenCalledWith(testCode);
    });

    test('should handle execution errors', async () => {
      const testCode = 'throw new Error("Test error");';
      const expectedError = 'Test error';

      mockCreatePromptRunner.mockRejectedValue(new Error(expectedError));

      const result = await testPrompt(testCode);

      expect(result.error).toBe(expectedError);
      expect(result.result).toBeUndefined();
    });

    test('should handle execution exceptions', async () => {
      const testCode = 'invalid code';

      mockCreatePromptRunner.mockRejectedValue(new Error('Execution failed'));

      const result = await testPrompt(testCode);

      expect(result.error).toBe('Execution failed');
      expect(result.result).toBeUndefined();
    });
  });

  describe('selectPrompt', () => {
    test('should select prompt by ID successfully', async () => {
      const mockPrompt = {
        id: 'test-prompt-id',
        title: 'Test Prompt',
        code: 'console.log("test");',
        description: 'Test description',
      };

      mockSelectPromptById.mockResolvedValue(mockPrompt as any);

      const result = await selectPrompt({ promptId: 'test-prompt-id' });

      expect(result).toEqual(mockPrompt);
      expect(mockSelectPromptById).toHaveBeenCalledWith({
        id: 'test-prompt-id',
        userId: 'test-user-id',
      });
    });

    test('should handle prompt not found', async () => {
      //@ts-expect-error
      mockSelectPromptById.mockResolvedValue(null);

      const result = await selectPrompt({ promptId: 'non-existent-id' });

      expect(result).toBeNull();
    });
  });

  describe('createWorkflowJob', () => {
    test('should create workflow job successfully', async () => {
      const mockDocument = {
        id: 'test-doc-id',
        userId: 'test-user-id',
        createdAt: new Date(),
        content: JSON.stringify({
          title: 'Test Workflow',
          type: 'info',
          error: null,
          todoList: {
            items: [],
            completedCount: 0,
            totalCount: 0,
          },
          toolDiscovery: {
            selectedTools: ['tool1', 'tool2'],
            reasoning: 'These tools are needed for the workflow',
          },
          suggestion: {
            modifications: ['Add error handling'],
            skipToolDiscovery: false,
          },
          workflow: {
            steps: [],
            trigger: {
              cron: '0 0 * * *',
            },
          },
        }),
      };

      const mockCreatedJob = {
        id: 'test-job-id',
        documentId: 'test-doc-id',
        userId: 'test-user-id',
        status: 'pending',
      };

      mockGetDocumentById.mockResolvedValue(mockDocument as any);
      mockGetJobByDocumentId.mockResolvedValue(null); // No existing job
      mockCreateJob.mockResolvedValue(mockCreatedJob as any);

      const result = await createWorkflowJob('test-doc-id');

      expect(result.error).toBeUndefined();
      expect(result.job).toEqual(mockCreatedJob);
      expect(mockGetDocumentById).toHaveBeenCalledWith({ id: 'test-doc-id' });
      expect(mockCreateJob).toHaveBeenCalled();
    });

    test('should return error when user not authenticated', async () => {
      //@ts-expect-error
      mockAuth.mockResolvedValue(null);

      const result = await createWorkflowJob('test-doc-id');

      expect(result.error).toBe('Unauthorized');
      expect(result.job).toBeUndefined();
    });

    test('should return error when document not found', async () => {
      //@ts-expect-error
      mockGetDocumentById.mockResolvedValue(null);

      const result = await createWorkflowJob('non-existent-doc-id');

      expect(result.error).toBe('Document not found');
      expect(result.job).toBeUndefined();
    });

    test('should return error when user does not own document', async () => {
      const mockDocument = {
        id: 'test-doc-id',
        userId: 'different-user-id', // Different from session user
        createdAt: new Date(),
        content: JSON.stringify({
          title: 'Test Workflow',
          type: 'info',
          error: null,
          toolDiscovery: {
            selectedTools: ['tool1', 'tool2'],
            reasoning: 'These tools are needed for the workflow',
          },
          suggestion: {
            modifications: ['Add error handling'],
            skipToolDiscovery: false,
          },
          workflow: {
            steps: [],
            trigger: {
              cron: '0 0 * * *',
            },
          },
        }),
      };

      mockGetDocumentById.mockResolvedValue(mockDocument as any);

      const result = await createWorkflowJob('test-doc-id');

      expect(result.error).toBe(
        'Unauthorized: You do not have access to this document',
      );
      expect(result.job).toBeUndefined();
    });

    test('should return existing job if one already exists', async () => {
      const mockDocument = {
        id: 'test-doc-id',
        userId: 'test-user-id',
        createdAt: new Date(),
        content: JSON.stringify({
          title: 'Test Workflow',
          type: 'info',
          error: null,
          todoList: {
            items: [],
            completedCount: 0,
            totalCount: 0,
          },
          toolDiscovery: {
            selectedTools: ['tool1', 'tool2'],
            reasoning: 'These tools are needed for the workflow',
          },
          suggestion: {
            modifications: ['Add error handling'],
            skipToolDiscovery: false,
          },
          workflow: {
            steps: [],
            trigger: {
              cron: '0 0 * * *',
            },
          },
        }),
      };

      const mockExistingJob = {
        id: 'existing-job-id',
        documentId: 'test-doc-id',
        userId: 'test-user-id',
        status: 'completed',
      };

      mockGetDocumentById.mockResolvedValue(mockDocument as any);
      mockGetJobByDocumentId.mockResolvedValue(mockExistingJob as any);

      const result = await createWorkflowJob('test-doc-id');

      expect(result.error).toBeUndefined();
      expect(result.job).toEqual(mockExistingJob);
      expect(mockCreateJob).not.toHaveBeenCalled(); // Should not create new job
    });

    test('should handle database errors', async () => {
      const mockDocument = {
        id: 'test-doc-id',
        userId: 'test-user-id',
        createdAt: new Date(),
        content: JSON.stringify({
          title: 'Test Workflow',
          type: 'info',
          error: null,
          toolDiscovery: {
            selectedTools: ['tool1', 'tool2'],
            reasoning: 'These tools are needed for the workflow',
          },
          suggestion: {
            modifications: ['Add error handling'],
            skipToolDiscovery: false,
          },
          workflow: {
            steps: [],
            trigger: {
              cron: '0 0 * * *',
            },
          },
        }),
      };

      mockGetDocumentById.mockResolvedValue(mockDocument as any);
      mockGetJobByDocumentId.mockResolvedValue(null);
      mockCreateJob.mockRejectedValue(new Error('Database error'));

      const result = await createWorkflowJob('test-doc-id');

      expect(result.error).toBe('Failed to create workflow job');
      expect(result.job).toBeUndefined();
    });
  });
});
