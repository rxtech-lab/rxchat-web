'use server';

import type { VisibilityType } from '@/components/visibility-selector';
import { createPromptRunner } from '@/lib/agent/prompt-runner/runner';
import { createMCPClient } from '@/lib/ai/mcp';
import type { ProviderType } from '@/lib/ai/models';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getDocumentById,
  getMessageById,
  selectPromptById,
  updateChatVisiblityById,
} from '@/lib/db/queries/queries';
import { generateText, type LanguageModel, type UIMessage } from 'ai';
import { cookies } from 'next/headers';
import { auth } from '../(auth)/auth';
import { isTestEnvironment, MAX_WORKFLOW_RETRIES } from '@/lib/constants';
import { db } from '@/lib/db/queries/client';
import {
  createJob,
  getJobByDocumentId,
  updateJobRunningStatus,
} from '@/lib/db/queries/job';
import { Client } from '@upstash/qstash';
import { getWorkflowWebhookUrl } from '@/lib/workflow/utils';
import { OnStepSchema } from '@/lib/workflow/types';

export async function saveChatModelAsCookie(
  model: string,
  provider: ProviderType,
) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
  cookieStore.set('chat-model-provider', provider);
}

export async function generateTitleFromUserMessage({
  message,
  titleModel,
}: {
  message: UIMessage;
  titleModel: LanguageModel;
}) {
  const { text: title } = await generateText({
    model: titleModel,
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}

export async function getMCPTools() {
  if (isTestEnvironment) {
    return [];
  }
  const mcpClient = await createMCPClient();
  const mcpTools = await mcpClient.tools();

  const tools: { title: string; description: string }[] = [];

  for (const [key, tool] of Object.entries(mcpTools)) {
    tools.push({
      title: key,
      description: tool.description ?? '',
    });
  }

  return tools;
}

export async function testPrompt(code: string): Promise<{
  result?: string;
  error?: string;
}> {
  'server-only';

  try {
    // only allow authenticated users to test prompts
    const session = await auth();
    if (!session?.user) {
      throw new Error('Unauthorized');
    }

    const result = await createPromptRunner(code);
    return { result };
  } catch (error) {
    console.error(error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function selectPrompt({
  promptId,
}: {
  promptId: string;
}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;
  await selectPromptById({ id: promptId, userId });
}

export async function createWorkflowJob(documentId: string) {
  const session = await auth();
  const workflowClient = new Client({
    token: process.env.QSTASH_TOKEN,
    baseUrl: process.env.QSTASH_URL,
  });

  const url = getWorkflowWebhookUrl();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;
  await db.transaction(async (tx) => {
    const document = await getDocumentById({
      id: documentId,
    });

    if (!document) {
      throw new Error('Document not found');
    }

    const parsedContent = OnStepSchema.parse(
      JSON.parse(document.content ?? '{}'),
    );

    // get job by documentId
    const previousJob = await getJobByDocumentId({
      documentId,
    });

    if (previousJob) {
      await workflowClient.schedules.delete(previousJob.id);
      await updateJobRunningStatus({
        id: previousJob.id,
        runningStatus: previousJob.runningStatus,
        dbConnection: tx,
      });
      await workflowClient.schedules.create({
        destination: url.toString(),
        scheduleId: previousJob.id,
        body: JSON.stringify({
          jobId: previousJob.id,
        }),
        cron: parsedContent.workflow.trigger.cron ?? '0 0 * * *',
        retries: MAX_WORKFLOW_RETRIES,
      });
      return previousJob;
    }

    const job = await createJob(
      {
        documentId,
        userId,
        status: 'pending',
        documentCreatedAt: document.createdAt,
        runningStatus: 'running',
      },
      tx,
    );

    await workflowClient.schedules.create({
      destination: url.toString(),
      scheduleId: job.id,
      body: JSON.stringify({
        jobId: job.id,
      }),
      // run every day
      cron: '0 0 * * *',
    });

    return job;
  });
}
