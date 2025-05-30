import 'server-only';
import { createClient } from 'redis';
import { generateUUID } from './utils';

export interface Challenge {
  id: string;
  challenge: string;
  userId?: string;
  type: 'registration' | 'authentication';
  createdAt: Date;
}

// Create Redis client - reuse the same pattern as resumable streams
let redisClient: ReturnType<typeof createClient> | null = null;

function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error(
        'REDIS_URL environment variable is required for WebAuthn challenges',
      );
    }
    redisClient = createClient({ url: redisUrl });
  }
  return redisClient;
}

/**
 * Create a new challenge for WebAuthn operations
 * The challenge will automatically expire after the specified TTL
 */
export async function createChallenge({
  challenge,
  userId,
  type,
  ttlSeconds = 300, // 5 minutes default
}: {
  challenge: string;
  userId?: string;
  type: 'registration' | 'authentication';
  ttlSeconds?: number;
}): Promise<Challenge> {
  const client = getRedisClient();

  if (!client.isOpen) {
    await client.connect();
  }

  const challengeId = generateUUID();
  const challengeData: Challenge = {
    id: challengeId,
    challenge,
    userId,
    type,
    createdAt: new Date(),
  };

  const key = `webauthn:challenge:${challengeId}`;

  try {
    // Store challenge in Redis with TTL for automatic expiration
    await client.setEx(key, ttlSeconds, JSON.stringify(challengeData));
    return challengeData;
  } catch (error) {
    throw new Error(
      `Failed to create challenge: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Get a challenge by ID
 * Returns null if challenge doesn't exist or has expired (Redis automatically handles expiration)
 */
export async function getChallenge(
  challengeId: string,
): Promise<Challenge | null> {
  const client = getRedisClient();

  if (!client.isOpen) {
    await client.connect();
  }

  const key = `webauthn:challenge:${challengeId}`;

  try {
    const challengeJson = await client.get(key);
    if (!challengeJson) {
      return null;
    }

    return JSON.parse(challengeJson) as Challenge;
  } catch (error) {
    throw new Error(
      `Failed to get challenge: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Delete a challenge (typically after successful use)
 * Redis TTL handles expiration automatically, but we delete immediately after use for security
 */
export async function deleteChallenge(challengeId: string): Promise<void> {
  const client = getRedisClient();

  if (!client.isOpen) {
    await client.connect();
  }

  const key = `webauthn:challenge:${challengeId}`;

  try {
    await client.del(key);
  } catch (error) {
    throw new Error(
      `Failed to delete challenge: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Optional: Close Redis connection (mainly for cleanup in tests)
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit();
    redisClient = null;
  }
}
