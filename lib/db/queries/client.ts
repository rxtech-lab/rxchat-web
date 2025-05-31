import { isTestEnvironment } from '@/lib/constants';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(
  isTestEnvironment
    ? (process.env.POSTGRES_URL_TEST ??
        'postgresql://postgres:postgres@localhost:5432/postgres')
    : // biome-ignore lint: Forbidden non-null assertion.
      process.env.POSTGRES_URL!,
);
export const db = drizzle(client);
