import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { isTestEnvironment } from './lib/constants';

config({
  path: '.env.local',
});

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: isTestEnvironment
      ? // biome-ignore lint: Forbidden non-null assertion.
        process.env.POSTGRES_URL_TEST!
      : // biome-ignore lint: Forbidden non-null assertion.
        process.env.POSTGRES_URL!,
  },
});
