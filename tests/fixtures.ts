import { expect as baseExpect, test as baseTest } from '@playwright/test';
import {
  createAuthenticatedContext,
  createPasskeyAuthenticatedContext,
  type PasskeyAuthenticatedContext,
  type UserContext,
} from './helpers';
import { getUnixTime } from 'date-fns';

interface Fixtures {
  adaContext: UserContext;
  babbageContext: UserContext;
  curieContext: UserContext;
  passkeyContext: PasskeyAuthenticatedContext;
}

export const test = baseTest.extend<{}, Fixtures>({
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
