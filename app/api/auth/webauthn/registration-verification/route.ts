import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth, signIn } from '@/app/(auth)/auth';
import { verifyPasskeyRegistration } from '@/lib/webauthn';
import { ChatSDKError } from '@/lib/errors';

const registrationVerificationSchema = z.object({
  response: z.any(), // WebAuthn response object
  challengeId: z.string(),
  name: z.string().optional(),
  email: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    // Parse request body
    const rawBody = await request.json();
    const parseResult = registrationVerificationSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 },
      );
    }

    const { response, challengeId, name, email } = parseResult.data;

    // For authenticated users, email is not required
    // For unauthenticated users (new registrations), email is required
    if (!session?.user?.id && !email) {
      return NextResponse.json(
        { error: 'Email is required for new user registration' },
        { status: 400 },
      );
    }

    const result = await verifyPasskeyRegistration({
      response,
      challengeId,
      name,
      email,
    });

    if (result.verified) {
      // For new user registrations (when there's no existing session), automatically sign them in
      if (!session?.user?.id) {
        try {
          await signIn('webauthn', {
            userId: result.userId,
            redirect: false,
          });

          return NextResponse.json({
            verified: true,
            message: 'Passkey registered successfully and signed in',
            userId: result.userId,
            signedIn: true,
          });
        } catch (signInError) {
          console.error('Auto sign-in after registration failed:', signInError);
          // Still return success for registration even if sign-in fails
          return NextResponse.json({
            verified: true,
            message: 'Passkey registered successfully, but auto sign-in failed',
            userId: result.userId,
            signedIn: false,
          });
        }
      } else {
        // For existing users adding additional passkeys
        return NextResponse.json({
          verified: true,
          message: 'Passkey registered successfully',
          userId: result.userId,
          signedIn: false, // Already signed in
        });
      }
    }

    return NextResponse.json(
      { error: 'Registration verification failed' },
      { status: 400 },
    );
  } catch (error) {
    console.error('WebAuthn registration verification error:', error);

    // Handle specific case where user already exists
    if (
      error instanceof ChatSDKError &&
      error.cause === 'User with this email already exists'
    ) {
      return NextResponse.json(
        { error: 'Account already exists' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to verify registration' },
      { status: 500 },
    );
  }
}
