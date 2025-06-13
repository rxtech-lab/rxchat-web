import { UserContextSchema, type UserContext } from '@/lib/types';
import { db } from './client';
import { eq } from 'drizzle-orm';
import { telegramUser } from '../schema';

export async function getUserContext(userId: string): Promise<UserContext> {
  const telegram = await db
    .select()
    .from(telegramUser)
    .where(eq(telegramUser.userId, userId))
    .limit(1);

  const parsedUser = UserContextSchema.parse({
    telegramId: telegram[0]?.tgId ?? null,
  });

  return parsedUser;
}
