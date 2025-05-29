'use client';

import { deleteAccount, type ActionResult } from '@/app/(chat)/profile/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { useActionState, useState } from 'react';

/**
 * Delete account card component with confirmation dialog
 */
export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(deleteAccount, null);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Account Deletion Warning</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>Deleting your account will permanently remove:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>All your chat conversations and history</li>
              <li>Any documents or artifacts you&apos;ve created</li>
              <li>Your profile information and preferences</li>
              <li>All associated account data</li>
            </ul>
            <p className="font-medium">This action is irreversible.</p>
          </AlertDescription>
        </Alert>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full"
              data-testid="delete-account-button"
            >
              <Trash2 className="size-4 mr-2" />
              Delete My Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-5" />
                Confirm Account Deletion
              </DialogTitle>
              <DialogDescription>
                Please confirm that you want to permanently delete your account
                by entering your password and typing &quot;DELETE&quot; below.
              </DialogDescription>
            </DialogHeader>

            {state && !state.success && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            )}

            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  data-testid="delete-password-input"
                  required
                />
                {state?.errors?.password && (
                  <p className="text-sm text-destructive">
                    {state.errors.password[0]}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmation">
                  Type &quot;DELETE&quot; to confirm
                </Label>
                <Input
                  id="confirmation"
                  name="confirmation"
                  placeholder="Type DELETE"
                  data-testid="delete-confirmation-input"
                  required
                />
                {state?.errors?.confirmation && (
                  <p className="text-sm text-destructive">
                    {state.errors.confirmation[0]}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="flex-1"
                  data-testid="delete-account-cancel-button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  className="flex-1"
                  disabled={isPending}
                  data-testid="delete-account-confirm-button"
                >
                  <Trash2 className="size-4 mr-2" />
                  {isPending ? 'Deleting...' : 'Delete Account'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
