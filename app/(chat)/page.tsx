import { cookies } from 'next/headers';

import { Chat } from '@/components/chat';
import {
  DEFAULT_CHAT_MODEL,
  getOpenRouterModels,
  type Providers,
  providers,
  type ProviderType,
} from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '../(auth)/auth';
import { redirect } from 'next/navigation';
import { entitlementsByUserType } from '@/lib/ai/entitlements';

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');
  const providerTypeFromCookie = cookieStore.get('chat-model-provider');

  const entitlements = entitlementsByUserType[session.user.type];

  const openRouterModels = await getOpenRouterModels(entitlements);
  const providerWithModels: Providers = {
    ...providers,
    openRouter: {
      ...providers.openRouter,
      models: openRouterModels,
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
      />
      <DataStreamHandler id={id} />
    </>
  );
}
