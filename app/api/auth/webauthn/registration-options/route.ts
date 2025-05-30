import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/app/(auth)/auth';
import { generatePasskeyRegistrationOptions } from '@/lib/webauthn';
import { getPasskeyAuthenticatorsByUserId } from '@/lib/db/queries';

const registrationOptionsSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    // Parse request body
    const rawBody = await request.json();
    const parseResult = registrationOptionsSchema.safeParse(rawBody);

    // For authenticated users (adding additional passkeys)
    if (session?.user?.id) {
      // Get current passkey count for informational purposes
      const existingPasskeys = await getPasskeyAuthenticatorsByUserId(
        session.user.id,
      );

      const name = session.user.name ?? session.user.email ?? 'User';

      const result = await generatePasskeyRegistrationOptions({
        userId: session.user.id,
        userName: session.user.email || 'User',
        userDisplayName: name || session.user.email || 'User',
      });

      return NextResponse.json({
        options: result.options,
        challengeId: result.challengeId,
        currentPasskeyCount: existingPasskeys.length,
      });
    } else {
      if (!parseResult.success) {
        return NextResponse.json(
          { error: 'Invalid request body', details: parseResult.error.issues },
          { status: 400 },
        );
      }
    }

    const { email } = parseResult.data;

    // For unauthenticated users (during sign-up)
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required for registration' },
        { status: 400 },
      );
    }

    // Generate a temporary user ID for the registration process
    // This will be replaced with the actual user ID during verification
    const tempUserId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await generatePasskeyRegistrationOptions({
      userId: tempUserId,
      userName: email,
      userDisplayName: email,
    });

    return NextResponse.json({
      options: result.options,
      challengeId: result.challengeId,
      currentPasskeyCount: 0,
    });
  } catch (error) {
    console.error('WebAuthn registration options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 },
    );
  }
}
