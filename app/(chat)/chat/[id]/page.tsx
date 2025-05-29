import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { entitlementsByUserRole } from '@/lib/ai/entitlements';
import {
  DEFAULT_CHAT_MODEL,
  getFilteredProviders,
  type ProviderType,
} from '@/lib/ai/models';
import {
  getChatById,
  getMessagesByChatId,
  getUserPromptByUserId,
  getUserById,
} from '@/lib/db/queries';
import type { DBMessage } from '@/lib/db/schema';
import type { Attachment, UIMessage } from 'ai';
import { isTestEnvironment } from '@/lib/constants';

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

  // Get user data from database to check role and available providers
  const user = await getUserById(session.user.id);
  if (!user) {
    redirect('/login');
  }

  const entitlements = entitlementsByUserRole[user.role];
  const providerWithModels = await getFilteredProviders(
    user,
    entitlements,
    isTestEnvironment,
  );

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get('chat-model');
  const providerTypeFromCookie = cookieStore.get('chat-model-provider');

  if (!chatModelFromCookie || !providerTypeFromCookie) {
    // Default to first available provider if no cookie is set
    const availableProviders = Object.values(providerWithModels).filter(
      (p) => p.models.length > 0,
    );
    const defaultProvider = availableProviders[0]?.provider || 'openRouter';
    const defaultModel =
      availableProviders[0]?.models[0]?.id || DEFAULT_CHAT_MODEL;

    return (
      <>
        <Chat
          id={chat.id}
          initialMessages={convertToUIMessages(messagesFromDb)}
          initialChatModel={defaultModel}
          initialVisibilityType={chat.visibility}
          isReadonly={session?.user?.id !== chat.userId}
          session={session}
          autoResume={true}
          providers={providerWithModels}
          selectedChatModelProvider={defaultProvider}
          selectedPrompt={selectedPrompt}
        />
        <DataStreamHandler id={id} />
      </>
    );
  }

  // Validate that the cached model/provider is still available to the user
  const cachedProvider =
    providerWithModels[providerTypeFromCookie.value as ProviderType];
  const isCachedModelAvailable = cachedProvider?.models.some(
    (model) => model.id === chatModelFromCookie.value,
  );

  if (!isCachedModelAvailable) {
    // Fall back to first available model if cached selection is no longer valid
    const availableProviders = Object.values(providerWithModels).filter(
      (p) => p.models.length > 0,
    );
    const defaultProvider = availableProviders[0]?.provider || 'openRouter';
    const defaultModel =
      availableProviders[0]?.models[0]?.id || DEFAULT_CHAT_MODEL;

    return (
      <>
        <Chat
          id={chat.id}
          initialMessages={convertToUIMessages(messagesFromDb)}
          initialChatModel={defaultModel}
          initialVisibilityType={chat.visibility}
          isReadonly={session?.user?.id !== chat.userId}
          session={session}
          autoResume={true}
          providers={providerWithModels}
          selectedChatModelProvider={defaultProvider}
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
