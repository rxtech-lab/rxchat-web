import { eq } from 'drizzle-orm';
import { telegramUser, type TelegramUser } from '../../schema';
import { db } from '../client';

/**
 * Check if a user has linked their Telegram account
 */
export async function getUserTelegramLink(
  userId: string,
): Promise<TelegramUser | null> {
  const result = await db
    .select()
    .from(telegramUser)
    .where(eq(telegramUser.userId, userId))
    .limit(1);

  return result[0] || null;
}

/**
 * Link a Telegram account to a user
 */
export async function linkTelegramToUser(
  userId: string,
  tgId: number,
  username?: string,
): Promise<TelegramUser> {
  const result = await db
    .insert(telegramUser)
    .values({
      tgId,
      username,
      userId,
      createdAt: new Date(),
      lastUsed: new Date(),
    })
    .returning();

  return result[0];
}

/**
 * Unlink a Telegram account from a user
 */
export async function unlinkTelegramFromUser(userId: string): Promise<void> {
  await db.delete(telegramUser).where(eq(telegramUser.userId, userId));
}

/**
 * Update last used timestamp for a Telegram link
 */
export async function updateTelegramLastUsed(tgId: number): Promise<void> {
  await db
    .update(telegramUser)
    .set({
      lastUsed: new Date(),
    })
    .where(eq(telegramUser.tgId, tgId));
}
