import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { generatePasskeyAuthenticationOptions } from '@/lib/webauthn';
import { authenticationOptionsSchema } from './schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = authenticationOptionsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request payload' },
        { status: 400 },
      );
    }

    const { userId } = validationResult.data;

    const result = await generatePasskeyAuthenticationOptions({
      userId,
    });

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
