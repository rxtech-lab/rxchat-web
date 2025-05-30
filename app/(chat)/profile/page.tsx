import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { ProfileTabs } from '@/components/profile-tabs';
import { AccountTab } from '@/components/profile/account-tab';
import { ProfileHeader } from '@/components/profile-header';

interface ProfilePageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const { tab = 'account' } = await searchParams;

  return (
    <div className="flex flex-col h-full">
      <ProfileHeader />

      <div className="max-w-4xl mx-auto p-6 space-y-6 flex-1">
        <div className="border-b pb-4">
          <h1 className="text-2xl font-semibold">Account Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>

        <ProfileTabs currentTab={tab} />

        <div className="flex-1">
          {tab === 'account' && <AccountTab user={session.user} />}
          {/* Future tabs can be added here */}
        </div>
      </div>
    </div>
  );
}
