import { cookies } from 'next/headers';

import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { entitlementsByUserRole } from '@/lib/ai/entitlements';
import {
  DEFAULT_CHAT_MODEL,
  getFilteredProviders,
  type ProviderType,
} from '@/lib/ai/models';
import { getUserById } from '@/lib/db/queries/queries';
import { getUserPromptByUserId } from '@/lib/db/queries/prompts';
import { generateUUID } from '@/lib/utils';
import { redirect } from 'next/navigation';
import { auth } from '../(auth)/auth';
import { isTestEnvironment } from '@/lib/constants';

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');
  const providerTypeFromCookie = cookieStore.get('chat-model-provider');
  const selectedPrompt = await getUserPromptByUserId({
    userId: session.user.id,
  });

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

  if (!modelIdFromCookie || !providerTypeFromCookie) {
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
          key={id}
          id={id}
          initialMessages={[]}
          initialChatModel={defaultModel}
          initialVisibilityType="private"
          isReadonly={false}
          session={session}
          autoResume={false}
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
    (model) => model.id === modelIdFromCookie.value,
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
          key={id}
          id={id}
          initialMessages={[]}
          initialChatModel={defaultModel}
          initialVisibilityType="private"
          isReadonly={false}
          session={session}
          autoResume={false}
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
        key={id}
        id={id}
        initialMessages={[]}
        initialChatModel={modelIdFromCookie.value}
        initialVisibilityType="private"
        isReadonly={false}
        session={session}
        autoResume={false}
        providers={providerWithModels}
        selectedChatModelProvider={providerTypeFromCookie.value as ProviderType}
        selectedPrompt={selectedPrompt}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
