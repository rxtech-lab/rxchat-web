'use client';

import { resetPassword, type ActionResult } from '@/app/(chat)/profile/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Key } from 'lucide-react';
import { useActionState, useEffect } from 'react';

/**
 * Password reset form component with server action integration
 */
export function PasswordResetForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    resetPassword,
    null,
  );

  useEffect(() => {
    if (state?.success) {
      // Reset form on success
      const form = document.getElementById(
        'password-reset-form',
      ) as HTMLFormElement;
      form?.reset();
    }
  }, [state?.success]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="size-5" />
          Reset Password
        </CardTitle>
        <CardDescription>
          Change your account password. Make sure to use a strong password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          id="password-reset-form"
          action={formAction}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              placeholder="Enter your current password"
              required
            />
            {state?.errors?.currentPassword && (
              <p className="text-sm text-destructive">
                {state.errors.currentPassword[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="Enter your new password"
              required
              minLength={6}
            />
            {state?.errors?.newPassword && (
              <p className="text-sm text-destructive">
                {state.errors.newPassword[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Confirm your new password"
              required
            />
            {state?.errors?.confirmPassword && (
              <p className="text-sm text-destructive">
                {state.errors.confirmPassword[0]}
              </p>
            )}
          </div>

          {state && (
            <Alert variant={state.success ? 'default' : 'destructive'}>
              {state.success ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <AlertCircle className="size-4" />
              )}
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" variant="default" className="w-full">
            Update Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
