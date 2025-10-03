'use server';

import { auth } from '@/app/(auth)/auth';
import {
  getUserTelegramLink,
  unlinkTelegramFromUser,
} from '@/lib/db/queries/link/telegram';
import { v4 } from 'uuid';

import { Redis } from '@upstash/redis';

/**
 * This function will generate a token and a link to link telegram to the user.
 * The token is JWT signed with the AUTH_SECRET with timeout to 10 minutes.
 */
export async function generateTelegramLink() {
  const session = await auth();
  const redis = Redis.fromEnv();

  if (!session?.user) {
    return {
      error: 'Unauthorized',
    };
  }

  if (!process.env.TELEGRAM_NOTIFICATION_BOT_USERNAME) {
    return {
      error: 'TELEGRAM_NOTIFICATION_BOT_USERNAME is not set',
    };
  }

  const userId = session.user.id;

  const token = v4();
  // save to the upstash
  await redis.set(`telegram:link:${token}`, userId, {
    ex: 60 * 10, // 10 minutes
  });

  return {
    link: `https://t.me/${process.env.TELEGRAM_NOTIFICATION_BOT_USERNAME}?start=token=${token}`,
  };
}

/**
 * Get the current Telegram link status for the authenticated user
 */
export async function getTelegramStatus() {
  const session = await auth();

  if (!session?.user) {
    return {
      error: 'Unauthorized',
    };
  }

  try {
    const telegramLink = await getUserTelegramLink(session.user.id);

    return {
      isLinked: !!telegramLink,
      userId: telegramLink?.tgId || undefined,
      linkedAt: telegramLink?.createdAt?.toISOString() || undefined,
    };
  } catch (error) {
    console.error('Error fetching telegram status:', error);
    return {
      error: 'Failed to fetch telegram status',
    };
  }
}

/**
 * Unlink the Telegram account for the authenticated user
 */
export async function unlinkTelegramAccount() {
  const session = await auth();

  if (!session?.user) {
    return {
      error: 'Unauthorized',
    };
  }

  try {
    await unlinkTelegramFromUser(session.user.id);
    return {
      success: true,
    };
  } catch (error) {
    console.error('Error unlinking telegram:', error);
    return {
      error: 'Failed to unlink telegram account',
    };
  }
}
