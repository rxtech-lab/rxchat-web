import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { verifyPasskeyRegistration } from '@/lib/webauthn';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const { response, challengeId, name } = await request.json();

    const result = await verifyPasskeyRegistration({
      response,
      challengeId,
      name,
    });

    if (result.verified) {
      return NextResponse.json({
        verified: true,
        message: 'Passkey registered successfully',
      });
    }

    return NextResponse.json(
      { error: 'Registration verification failed' },
      { status: 400 },
    );
  } catch (error) {
    console.error('WebAuthn registration verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify registration' },
      { status: 500 },
    );
  }
}
