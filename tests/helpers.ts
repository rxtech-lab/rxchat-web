import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
} from '@playwright/test';
import { generateId } from 'ai';
import { getUnixTime } from 'date-fns';
import fs from 'node:fs';
import path from 'node:path';
import { ChatPage } from './pages/chat';

export type TestUser = {
  email: string;
  password: string;
};

export type UserContext = {
  context: BrowserContext;
  page: Page;
  request: APIRequestContext;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export type PasskeyAuthenticatedContext = Omit<UserContext, 'user'> & {
  passkey: {
    authenticatorId: string;
    asserted: () => Promise<void>;
    addCredential: (credential: {
      credentialId: string;
      isResidentCredential: boolean;
      rpId: string;
      privateKey: string;
      userHandle: string;
      signCount: number;
    }) => Promise<void>;
    getCredentials: () => Promise<any[]>;
    clearCredentials: () => Promise<void>;
    client: any; // CDP client for advanced operations
  };
};

export async function createAuthenticatedContext({
  browser,
  name,
  chatModel = 'chat-model',
}: {
  browser: Browser;
  name: string;
  chatModel?: 'chat-model' | 'chat-model-reasoning';
}): Promise<UserContext> {
  const directory = path.join(__dirname, '../playwright/.sessions');

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const storageFile = path.join(directory, `${name}.json`);

  const context = await browser.newContext();
  const page = await context.newPage();

  const email = `test-${name}@playwright.com`;
  const password = generateId(16);

  await page.goto('http://localhost:3000/register');
  await page.getByPlaceholder('user@acme.com').click();
  await page.getByPlaceholder('user@acme.com').fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('textbox', { name: 'Password' }).first().click();
  await page.getByRole('textbox', { name: 'Password' }).first().fill(password);

  await page.getByRole('textbox', { name: 'Confirm Password' }).first().click();
  await page
    .getByRole('textbox', { name: 'Confirm Password' })
    .first()
    .fill(password);

  await page.getByRole('button', { name: 'Sign Up' }).click();

  await expect(page.getByTestId('toast')).toContainText(
    'Account created successfully!',
  );

  const chatPage = new ChatPage(page);
  await chatPage.createNewChat();

  await page.waitForTimeout(1000);
  await context.storageState({ path: storageFile });
  await page.close();

  const newContext = await browser.newContext({ storageState: storageFile });
  const newPage = await newContext.newPage();

  const user = await newPage.request.get('/api/user');
  const content = await user.text();
  const userData = JSON.parse(content);

  return {
    context: newContext,
    page: newPage,
    request: newContext.request,
    user: userData,
  };
}

export async function createPasskeyAuthenticatedContext({
  browser,
  name,
}: {
  browser: Browser;
  name: string;
}): Promise<PasskeyAuthenticatedContext> {
  const directory = path.join(__dirname, '../playwright/.sessions');

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const storageFile = path.join(directory, `${name}.json`);
  const context = await browser.newContext();
  const page = await context.newPage();

  await context.storageState({ path: storageFile });
  await page.close();

  const newContext = await browser.newContext({ storageState: storageFile });
  const newPage = await newContext.newPage();

  // add passkey support
  const client = await newContext.newCDPSession(newPage);
  await client.send('WebAuthn.enable');
  const { authenticatorId } = await client.send(
    'WebAuthn.addVirtualAuthenticator',
    {
      options: {
        protocol: 'ctap2',
        transport: 'usb',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );

  const asserted = () =>
    new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Passkey assertion timeout after 10 seconds'));
      }, 10000);

      client.once('WebAuthn.credentialAsserted', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

  const addCredential = async (credential: {
    credentialId: string;
    isResidentCredential: boolean;
    rpId: string;
    privateKey: string;
    userHandle: string;
    signCount: number;
  }) => {
    await client.send('WebAuthn.addCredential', {
      authenticatorId,
      credential,
    });
  };

  const getCredentials = async () => {
    const result = await client.send('WebAuthn.getCredentials', {
      authenticatorId,
    });
    return result.credentials;
  };

  const clearCredentials = async () => {
    await client.send('WebAuthn.clearCredentials', {
      authenticatorId,
    });
  };

  return {
    context: newContext,
    page: newPage,
    request: newContext.request,
    passkey: {
      authenticatorId,
      asserted,
      addCredential,
      getCredentials,
      clearCredentials,
      client,
    },
  };
}

export function generateRandomTestUser() {
  const email = `test-${getUnixTime(new Date())}@playwright.com`;
  const password = generateId(16);

  return {
    email,
    password,
  };
}

export async function getRealWorldTestUrl() {
  if (process.env.PLAYWRIGHT_TEST_BASE_URL) {
    return process.env.PLAYWRIGHT_TEST_BASE_URL;
  }
  return 'http://localhost:3000';
}
