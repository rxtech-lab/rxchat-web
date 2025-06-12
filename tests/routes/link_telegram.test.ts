import { db } from '@/lib/db/queries/client';
import { getUserTelegramLink } from '@/lib/db/queries/link/telegram';
import { user } from '@/lib/db/schema';
import { generateUUID } from '@/lib/utils';
import { Redis } from '@upstash/redis';
import { expect, test } from '../fixtures';

test.describe('POST /api/auth/link/telegram', () => {
  let redis: Redis;

  test.beforeAll(() => {
    redis = new Redis({
      url: 'http://localhost:8079',
      token: 'example_token',
    });
  });

  test.beforeEach(async () => {
    await redis.flushall();
    // delete every user
    await db.delete(user);
  });

  test('should return error for invalid token', async ({ request }) => {
    const response = await request.post('/api/auth/link/telegram', {
      data: {
        token: 'invalid-token',
        tgId: 123456789,
      },
    });

    expect(response.status()).toBe(400);
    const responseData = await response.json();
    expect(responseData).toEqual({ error: 'Invalid token' });
  });

  test('should return error for missing token', async ({ request }) => {
    const response = await request.post('/api/auth/link/telegram', {
      data: {
        tgId: 123456789,
      },
    });

    expect(response.status()).toBe(400);
    const responseData = await response.json();
    expect(responseData).toEqual({ error: 'Invalid token' });
  });

  test('should successfully link telegram with valid token', async ({
    adaContext,
  }) => {
    const token = generateUUID();
    const tgId = 987654321;

    // Set up Redis with valid token pointing to user
    await redis.set(`telegram:link:${token}`, adaContext.user.id);

    const response = await adaContext.request.post('/api/auth/link/telegram', {
      data: {
        token,
        tgId,
      },
    });

    expect(response.status()).toBe(200);
    const responseData = await response.json();
    expect(responseData).toEqual({ message: 'Telegram linked successfully' });

    // Verify the link was created in the database
    const telegramLink = await getUserTelegramLink(adaContext.user.id);
    expect(telegramLink).toBeDefined();
    expect(telegramLink?.tgId).toBe(tgId);
    expect(telegramLink?.userId).toBe(adaContext.user.id);

    // Verify the token was deleted from Redis
    const tokenValue = await redis.get(`telegram:link:${token}`);
    expect(tokenValue).toBeNull();
  });

  test('should fail to link telegram multiple times', async ({
    adaContext,
  }) => {
    const token = generateUUID();
    const tgId = 987654321;

    // Set up Redis with valid token pointing to user
    await redis.set(`telegram:link:${token}`, adaContext.user.id);

    const response = await adaContext.request.post('/api/auth/link/telegram', {
      data: {
        token,
        tgId,
      },
    });

    expect(response.status()).toBe(200);
    const responseData = await response.json();
    expect(responseData).toEqual({ message: 'Telegram linked successfully' });

    const response2 = await adaContext.request.post('/api/auth/link/telegram', {
      data: {
        token,
        tgId,
      },
    });
    expect(response2.status()).toBe(400);
  });

  test('should handle telegram linking with username', async ({
    babbageContext,
  }) => {
    const token = generateUUID();
    const tgId = 111222333;

    // Set up Redis with valid token pointing to user
    await redis.set(`telegram:link:${token}`, babbageContext.user.id);

    const response = await babbageContext.request.post(
      '/api/auth/link/telegram',
      {
        data: {
          token,
          tgId,
          username: 'test_user',
        },
      },
    );

    expect(response.status()).toBe(200);
    const responseData = await response.json();
    expect(responseData).toEqual({ message: 'Telegram linked successfully' });

    // Verify the link was created in the database
    const telegramLink = await getUserTelegramLink(babbageContext.user.id);
    expect(telegramLink).toBeDefined();
    expect(telegramLink?.tgId).toBe(tgId);
    expect(telegramLink?.userId).toBe(babbageContext.user.id);

    // Verify the token was deleted from Redis
    const tokenValue = await redis.get(`telegram:link:${token}`);
    expect(tokenValue).toBeNull();
  });

  test('should handle expired/deleted tokens gracefully', async ({
    adaContext,
  }) => {
    const token = generateUUID();
    const tgId = 444555666;

    // Set up Redis token then immediately delete it to simulate expiration
    await redis.set(`telegram:link:${token}`, adaContext.user.id);
    await redis.del(`telegram:link:${token}`);

    const response = await adaContext.request.post('/api/auth/link/telegram', {
      data: {
        token,
        tgId,
      },
    });

    expect(response.status()).toBe(400);
    const responseData = await response.json();
    expect(responseData).toEqual({ error: 'Invalid token' });
  });
});
