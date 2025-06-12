import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { ProfileTabs } from '@/components/profile-tabs';
import { AccountTab } from '@/components/profile/account-tab';
import { LinkingTab } from '@/components/profile/linking-tab';
import { ProfileHeader } from '@/components/profile-header';
import { getUserTelegramLink } from '@/lib/db/queries/link/telegram';

interface ProfilePageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const { tab = 'account' } = await searchParams;

  // Get initial telegram link status for server-side rendering
  let initialTelegramStatus: {
    isLinked: boolean;
    username: string | undefined;
    linkedAt: string | undefined;
  } = {
    isLinked: false,
    username: undefined,
    linkedAt: undefined,
  };
  if (tab === 'linking') {
    const telegramLink = await getUserTelegramLink(session.user.id);
    initialTelegramStatus = {
      isLinked: !!telegramLink,
      username: telegramLink?.username || undefined,
      linkedAt: telegramLink?.createdAt?.toISOString() || undefined,
    };
  }

  return (
    <div className="flex flex-col h-full">
      <ProfileHeader />

      <div className="max-w-4xl mx-auto p-6 space-y-6 flex-1 w-full">
        <div className="border-b pb-4">
          <h1 className="text-2xl font-semibold">Account Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>

        <ProfileTabs currentTab={tab} />

        <div className="flex-1">
          {tab === 'account' && <AccountTab user={session.user} />}
          {tab === 'linking' && (
            <LinkingTab
              initialTelegramStatus={initialTelegramStatus}
              userId={session.user.id}
            />
          )}
          {/* Future tabs can be added here */}
        </div>
      </div>
    </div>
  );
}
