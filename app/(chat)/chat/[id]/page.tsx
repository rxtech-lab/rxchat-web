import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import {
  DEFAULT_CHAT_MODEL,
  getOpenRouterModels,
  providers,
  type ProviderType,
  type Providers,
} from '@/lib/ai/models';
import {
  getChatById,
  getMessagesByChatId,
  getUserPromptByUserId,
} from '@/lib/db/queries';
import type { DBMessage } from '@/lib/db/schema';
import type { Attachment, UIMessage } from 'ai';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const chat = await getChatById({ id });

  if (!chat) {
    notFound();
  }

  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  if (chat.visibility === 'private') {
    if (!session.user) {
      return notFound();
    }

    if (session.user.id !== chat.userId) {
      return notFound();
    }
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });
  const selectedPrompt = await getUserPromptByUserId({
    userId: session.user.id,
  });

  function convertToUIMessages(messages: Array<DBMessage>): Array<UIMessage> {
    return messages.map((message) => ({
      id: message.id,
      parts: message.parts as UIMessage['parts'],
      role: message.role as UIMessage['role'],
      // Note: content will soon be deprecated in @ai-sdk/react
      content: '',
      createdAt: message.createdAt,
      experimental_attachments:
        (message.attachments as Array<Attachment>) ?? [],
    }));
  }

  const entitlements = entitlementsByUserType[session.user.type];

  const openRouterModels = await getOpenRouterModels(entitlements);
  const providerWithModels: Providers = {
    ...providers,
    openRouter: {
      ...providers.openRouter,
      models: openRouterModels,
    },
  };
  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get('chat-model');
  const providerTypeFromCookie = cookieStore.get('chat-model-provider');

  if (!chatModelFromCookie || !providerTypeFromCookie) {
    return (
      <>
        <Chat
          id={chat.id}
          initialMessages={convertToUIMessages(messagesFromDb)}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialVisibilityType={chat.visibility}
          isReadonly={session?.user?.id !== chat.userId}
          session={session}
          autoResume={true}
          providers={providerWithModels}
          selectedChatModelProvider={'openRouter'}
          selectedPrompt={selectedPrompt}
        />
        <DataStreamHandler id={id} />
      </>
    );
  }

  return (
    <>
      <Chat
        id={chat.id}
        initialMessages={convertToUIMessages(messagesFromDb)}
        initialChatModel={chatModelFromCookie.value}
        initialVisibilityType={chat.visibility}
        isReadonly={session?.user?.id !== chat.userId}
        session={session}
        autoResume={true}
        providers={providerWithModels}
        selectedChatModelProvider={
          providerTypeFromCookie?.value as ProviderType
        }
        selectedPrompt={selectedPrompt}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
