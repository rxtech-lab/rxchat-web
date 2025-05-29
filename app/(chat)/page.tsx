import { cookies } from 'next/headers';

import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import {
  DEFAULT_CHAT_MODEL,
  getOpenRouterModels,
  getTestModels,
  type Providers,
  providers,
  type ProviderType,
} from '@/lib/ai/models';
import { getUserPromptByUserId } from '@/lib/db/queries';
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

  const entitlements = entitlementsByUserType[session.user.type];

  const openRouterModels = await getOpenRouterModels(entitlements);
  const testModels = getTestModels();
  const providerWithModels: Providers = {
    ...providers,
    openRouter: {
      ...providers.openRouter,
      models: openRouterModels,
    },
    test: {
      ...providers.test,
      models: isTestEnvironment ? testModels : [],
    },
  };

  if (!modelIdFromCookie || !providerTypeFromCookie) {
    return (
      <>
        <Chat
          key={id}
          id={id}
          initialMessages={[]}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialVisibilityType="private"
          isReadonly={false}
          session={session}
          autoResume={false}
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
