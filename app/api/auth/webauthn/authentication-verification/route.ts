import { verifyPasskeyAuthentication } from '@/lib/webauthn';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authenticationVerificationSchema } from './schema';

// Define the validation schema for the request payload

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate the request payload using Zod
    const validationResult = authenticationVerificationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request payload',
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { response, challengeId } = validationResult.data;

    const result = await verifyPasskeyAuthentication({
      response,
      challengeId,
    });

    if (result.verified) {
      return NextResponse.json({
        verified: true,
        userId: result.userId,
        message: 'Authentication successful',
      });
    }

    return NextResponse.json(
      { error: 'Authentication verification failed' },
      { status: 400 },
    );
  } catch (error: any) {
    console.error('WebAuthn authentication verification error:', error);
    // if not found
    if ('message' in error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to verify authentication' },
      { status: 500 },
    );
  }
}
