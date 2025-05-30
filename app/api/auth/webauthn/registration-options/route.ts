import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { generatePasskeyRegistrationOptions } from '@/lib/webauthn';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const name = session.user.name ?? session.user.email ?? 'User';

    const result = await generatePasskeyRegistrationOptions({
      userId: session.user.id,
      userName: session.user.email || 'User',
      userDisplayName: name || session.user.email || 'User',
    });

    return NextResponse.json({
      options: result.options,
      challengeId: result.challengeId,
    });
  } catch (error) {
    console.error('WebAuthn registration options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 },
    );
  }
}
