import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { generatePasskeyAuthenticationOptions } from '@/lib/webauthn';
import { authenticationOptionsSchema } from './schema';
import { isTestEnvironment } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = authenticationOptionsSchema.safeParse(body);
    const timeout = isTestEnvironment ? 2000 : undefined;

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request payload' },
        { status: 400 },
      );
    }
    let result: {
      options: PublicKeyCredentialRequestOptionsJSON;
      challengeId: string;
    };
    const data = validationResult.data;

    if ('userId' in data && data.userId) {
      result = await generatePasskeyAuthenticationOptions({
        userId: data.userId,
        challengeTTLSeconds: timeout,
      });
    } else if ('email' in data && data.email) {
      result = await generatePasskeyAuthenticationOptions({
        email: data.email,
        challengeTTLSeconds: timeout,
      });
    } else {
      // Handle empty request for discoverable credentials
      result = await generatePasskeyAuthenticationOptions({
        challengeTTLSeconds: timeout,
      });
    }

    return NextResponse.json({
      options: result.options,
      challengeId: result.challengeId,
    });
  } catch (error) {
    console.error('WebAuthn authentication options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 },
    );
  }
}
