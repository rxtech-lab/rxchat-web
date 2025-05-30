'use client';

import {
  authenticateWithPasskey,
  isWebAuthnSupported,
  registerPasskey,
} from '@/lib/webauthn-client';
import { Key } from 'lucide-react';
import { signIn } from 'next-auth/react';
import Form from 'next/form';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';

export function AuthForm({
  action,
  children,
  defaultEmail = '',
  isRegister = false,
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
  isRegister?: boolean;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [showPasskeyOption, setShowPasskeyOption] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [isPasskeyRegistering, setIsPasskeyRegistering] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<
    'email' | 'password'
  >('email');

  useEffect(() => {
    // Check if WebAuthn is supported and show passkey option
    if (isWebAuthnSupported()) {
      setShowPasskeyOption(true);
    }
  }, []);

  const handlePasskeySignIn = async () => {
    setIsPasskeyLoading(true);

    try {
      let result: {
        success: boolean;
        message: string;
        userId?: string;
      };

      // First try conditional authentication for a truly passwordless experience
      try {
        // Fall back to email-based authentication
        result = await authenticateWithPasskey(undefined, email || undefined);
      } catch (conditionalError) {
        console.warn(
          'Conditional passkey authentication failed, falling back to email-based:',
          conditionalError,
        );
        // Fall back to email-based authentication if conditional fails
        result = await authenticateWithPasskey(undefined, email || undefined);
      }

      if (result.success && result.userId) {
        // Use NextAuth signIn with custom credentials provider for WebAuthn
        const signInResult = await signIn('webauthn', {
          userId: result.userId,
          redirect: false,
        });

        if (signInResult?.ok) {
          toast.success('Signed in successfully with passkey');
          window.location.href = '/';
        } else {
          toast.error('Failed to complete sign-in');
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Passkey sign-in error:', error);
      toast.error('Failed to sign in with passkey');
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const handlePasskeyRegistration = async () => {
    if (!email) {
      toast.error('Please enter your email address first');
      return;
    }

    setIsPasskeyRegistering(true);

    try {
      const result = await registerPasskey(`${email} Passkey`, email);

      if (result.success) {
        if (result.signedIn) {
          toast.success(
            'Passkey registered and signed in successfully! Redirecting...',
          );
          // Give user time to see the success message, then redirect
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        } else {
          toast.success(
            'Passkey registered successfully! You can now sign in with your passkey.',
          );
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Passkey registration error:', error);
      toast.error('Failed to register passkey');
    } finally {
      setIsPasskeyRegistering(false);
    }
  };

  const handleContinueToPassword = () => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    setRegistrationStep('password');
  };

  // Show registration form
  if (isRegister) {
    return (
      <div className="flex flex-col gap-4 px-4 sm:px-16">
        <Form action={action} className="flex flex-col gap-4">
          {/* Email field - always shown */}
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="email"
              className="text-zinc-600 font-normal dark:text-zinc-400"
            >
              Email Address
            </Label>

            <Input
              id="email"
              name={registrationStep === 'password' ? '' : 'email'}
              className="bg-muted text-md md:text-sm"
              type="email"
              placeholder="user@acme.com"
              autoComplete="email webauthn"
              required={registrationStep === 'email'}
              autoFocus={registrationStep === 'email'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={registrationStep === 'password'}
            />
          </div>

          {/* Hidden email field for password step to ensure email is submitted */}
          {registrationStep === 'password' && (
            <input type="hidden" name="email" value={email} />
          )}

          {/* Password fields - only shown in password step */}
          {registrationStep === 'password' && (
            <>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="password"
                  className="text-zinc-600 font-normal dark:text-zinc-400"
                >
                  Password
                </Label>

                <Input
                  id="password"
                  name="password"
                  className="bg-muted text-md md:text-sm"
                  type="password"
                  required
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="confirmPassword"
                  className="text-zinc-600 font-normal dark:text-zinc-400"
                >
                  Confirm Password
                </Label>

                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  className="bg-muted text-md md:text-sm"
                  type="password"
                  required
                />
              </div>

              {children}
            </>
          )}
        </Form>

        {/* Email step - show Continue and Passkey options */}
        {registrationStep === 'email' && (
          <>
            <Button
              type="button"
              className="w-full"
              onClick={handleContinueToPassword}
              disabled={!email}
            >
              Continue
            </Button>

            {showPasskeyOption && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handlePasskeyRegistration}
                  disabled={isPasskeyRegistering || !email}
                >
                  <Key className="size-4 mr-2" />
                  {isPasskeyRegistering
                    ? 'Registering...'
                    : 'Register with Passkey'}
                </Button>
              </>
            )}
          </>
        )}

        {/* Password step - show Back button */}
        {registrationStep === 'password' && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setRegistrationStep('email')}
          >
            Back to Email
          </Button>
        )}
      </div>
    );
  }

  // Show sign-in form with both email and password fields
  return (
    <div className="flex flex-col gap-4 px-4 sm:px-16">
      <Form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="email"
            className="text-zinc-600 font-normal dark:text-zinc-400"
          >
            Email Address
          </Label>

          <Input
            id="email"
            name="email"
            className="bg-muted text-md md:text-sm"
            type="email"
            placeholder="user@acme.com"
            autoComplete="email webauthn"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="password"
            className="text-zinc-600 font-normal dark:text-zinc-400"
          >
            Password
          </Label>

          <Input
            id="password"
            name="password"
            className="bg-muted text-md md:text-sm"
            type="password"
            required
          />
        </div>

        {children}
      </Form>

      {showPasskeyOption && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handlePasskeySignIn}
            disabled={isPasskeyLoading}
          >
            <Key className="size-4 mr-2" />
            {isPasskeyLoading ? 'Signing in...' : 'Sign in with Passkey'}
          </Button>
        </>
      )}
    </div>
  );
}
