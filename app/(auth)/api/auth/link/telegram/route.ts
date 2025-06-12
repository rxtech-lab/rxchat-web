import { NextResponse, type NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';
import { linkTelegramToUser } from '@/lib/db/queries/link/telegram';

export async function POST(request: NextRequest) {
  try {
    const redis = Redis.fromEnv();
    const json = await request.json();
    const { token } = json;

    // check if the token is valid
    const userId = await redis.getdel(`telegram:link:${token}`);

    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // link the telegram to the user
    await linkTelegramToUser(userId as string, json.tgId);

    return NextResponse.json({ message: 'Telegram linked successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
