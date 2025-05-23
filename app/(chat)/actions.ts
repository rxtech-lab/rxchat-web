'use server';

import type { VisibilityType } from '@/components/visibility-selector';
import { mcpClient } from '@/lib/ai/mcp';
import type { ProviderType } from '@/lib/ai/models';
import { titleModel } from '@/lib/ai/providers';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from '@/lib/db/queries';
import { generateText, type UIMessage } from 'ai';
import { cookies } from 'next/headers';

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
}: {
  message: UIMessage;
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
