import {
  expect as baseExpect,
  test as baseTest,
  type Page,
} from '@playwright/test';
import {
  createAuthenticatedContext,
  createPasskeyAuthenticatedContext,
  getRealWorldTestUrl,
  type PasskeyAuthenticatedContext,
  type UserContext,
} from './helpers';
import { getUnixTime } from 'date-fns';

interface Fixtures {
  adaContext: UserContext;
  babbageContext: UserContext;
  curieContext: UserContext;
  passkeyContext: PasskeyAuthenticatedContext;
  realworldContext: { page: Page; context: any; baseUrl: string };
}

export const test = baseTest.extend<{}, Fixtures>({
  realworldContext: [
    async ({ browser }, use, workerInfo) => {
      const baseUrl = await getRealWorldTestUrl();
      const context = await browser.newContext();
      const page = await context.newPage();

      // Add Vercel protection bypass header to all requests
      await page.setExtraHTTPHeaders({
        'x-vercel-protection-bypass':
          process.env.VERCEL_AUTOMATION_BYPASS_SECRET || 'bypass',
      });

      await use({ page, context, baseUrl });
      await context.close();
    },
    { scope: 'worker' },
  ],
  passkeyContext: [
    async ({ browser }, use, workerInfo) => {
      const passkey = await createPasskeyAuthenticatedContext({
        browser,
        name: `passkey-${workerInfo.workerIndex}-${getUnixTime(new Date())}`,
      });

      await use(passkey);
      await passkey.context.close();
    },
    { scope: 'worker' },
  ],
  adaContext: [
    async ({ browser }, use, workerInfo) => {
      const ada = await createAuthenticatedContext({
        browser,
        name: `ada-${workerInfo.workerIndex}-${getUnixTime(new Date())}`,
      });

      await use(ada);
      await ada.context.close();
    },
    { scope: 'worker' },
  ],
  babbageContext: [
    async ({ browser }, use, workerInfo) => {
      const babbage = await createAuthenticatedContext({
        browser,
        name: `babbage-${workerInfo.workerIndex}-${getUnixTime(new Date())}`,
      });

      await use(babbage);
      await babbage.context.close();
    },
    { scope: 'worker' },
  ],
  curieContext: [
    async ({ browser }, use, workerInfo) => {
      const curie = await createAuthenticatedContext({
        browser,
        name: `curie-${workerInfo.workerIndex}-${getUnixTime(new Date())}`,
        chatModel: 'chat-model-reasoning',
      });

      await use(curie);
      await curie.context.close();
    },
    { scope: 'worker' },
  ],
});

export const expect = baseExpect;
