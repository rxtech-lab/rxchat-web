import Image from 'next/image';
import type { User } from 'next-auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DeleteAccountCard } from './delete-account-card';
import { PasswordResetForm } from './password-reset-form';
import { SignInMethodsCard } from './sign-in-methods-card';

interface AccountTabProps {
  user: User;
}

/**
 * Account tab component displaying user profile information and account management options
 */
export function AccountTab({ user }: AccountTabProps) {
  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <Card data-testid="profile-information-card">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Your basic account information and profile details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Image
              src={`https://avatar.vercel.sh/${user.email}`}
              alt={user.email ?? 'User Avatar'}
              width={64}
              height={64}
              className="rounded-full"
            />
            <div>
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground">
                Account Type: {user.type || 'regular'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Password Reset */}
      <PasswordResetForm />

      <Separator />

      {/* Sign-in Methods */}
      <SignInMethodsCard />

      <Separator />

      {/* Danger Zone */}
      <DeleteAccountCard />
    </div>
  );
}
