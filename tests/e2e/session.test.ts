import { expect, test } from '../fixtures';
import { AuthPage } from '../pages/auth';
import { generateRandomTestUser, type TestUser } from '../helpers';
import { ChatPage } from '../pages/chat';
import { getMessageByErrorCode } from '@/lib/errors';

test.describe
  .serial('Login and Registration', () => {
    let authPage: AuthPage;

    const testUser = generateRandomTestUser();

    test.beforeEach(async ({ page }) => {
      authPage = new AuthPage(page);
    });

    test('Register new account', async () => {
      await authPage.register(testUser.email, testUser.password);
      await authPage.expectToastToContain('Account created successfully!');
    });

    test('Register new account with existing email', async () => {
      await authPage.register(testUser.email, testUser.password);
      await authPage.expectToastToContain('Account already exists!');
    });

    test('Log into account that exists', async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);

      await page.waitForURL('/');
      await expect(page.getByPlaceholder('Send a message...')).toBeVisible();
    });

    test('Display user email in user menu', async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);

      await page.waitForURL('/');
      await expect(page.getByPlaceholder('Send a message...')).toBeVisible();

      const userEmail = await page.getByTestId('user-email');
      await expect(userEmail).toHaveText(testUser.email);
    });

    test('Log out as non-guest user', async () => {
      await authPage.login(testUser.email, testUser.password);
      await authPage.logout(testUser.email, testUser.password, true);
    });

    test('Do not navigate to /register for non-guest users', async ({
      page,
    }) => {
      await authPage.login(testUser.email, testUser.password);

      const inputBox = page.getByTestId('multimodal-input');
      await expect(inputBox).toBeVisible();
      await page.goto('/register');
      await expect(page).toHaveURL('/');
    });

    test('Do not navigate to /login for non-guest users', async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);
      await page.waitForURL('/');

      await page.goto('/login');
      await expect(page).toHaveURL('/');
    });
  });

test.describe('Entitlements', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
  });

  test.skip('Guest user cannot send more than 20 messages/day', async () => {
    await chatPage.createNewChat();

    for (let i = 0; i <= 20; i++) {
      await chatPage.sendUserMessage('Why is the sky blue?');
      await chatPage.isGenerationComplete();
    }

    await chatPage.sendUserMessage('Why is the sky blue?');
    await chatPage.expectToastToContain(
      getMessageByErrorCode('rate_limit:chat'),
    );
  });
});

test.describe('Profile', () => {
  test.describe('Delete account', () => {
    let authPage: AuthPage;
    let testUser: TestUser;

    test.beforeEach(async ({ page }) => {
      authPage = new AuthPage(page);
      testUser = generateRandomTestUser();
      await authPage.register(testUser.email, testUser.password);
      await authPage.expectToastToContain('Account created successfully!');
    });

    test('User should be able to delete account', async ({ page }) => {
      // Navigate to profile page
      await page.goto('/profile');

      // Scroll down to find delete account section
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Click delete account button to open dialog
      await page.getByTestId('delete-account-button').click();

      // Enter correct password
      await page.getByTestId('delete-password-input').fill(testUser.password);

      // Enter confirmation word "DELETE"
      await page.getByTestId('delete-confirmation-input').fill('DELETE');

      // Click confirm delete button
      await page.getByTestId('delete-account-confirm-button').click();

      // Should be redirected to login page
      await page.waitForURL('/');
      await expect(page).toHaveURL('/');

      // Verify user cannot login with old credentials
      await authPage.login(testUser.email, testUser.password);
      await authPage.expectToastToContain('Invalid credentials!');
    });

    test('User enters wrong password for account deletion', async ({
      page,
    }) => {
      // Navigate to profile page
      await page.goto('/profile');

      // Scroll down to find delete account section
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Click delete account button to open dialog
      await page.getByTestId('delete-account-button').click();

      // Enter incorrect password
      await page.getByTestId('delete-password-input').fill('wrongpassword');

      // Enter confirmation word "DELETE"
      await page.getByTestId('delete-confirmation-input').fill('DELETE');

      // Click confirm delete button
      await page.getByTestId('delete-account-confirm-button').click();

      // Should see error message
      await expect(
        page.getByText('Password is incorrect').first(),
      ).toBeVisible();

      // Refresh page and verify still logged in
      await page.reload();
      await expect(page.getByTestId('profile-information-card')).toBeVisible();
    });

    test('User enters wrong confirmation word for account deletion', async ({
      page,
    }) => {
      // Navigate to profile page
      await page.goto('/profile');

      // Scroll down to find delete account section
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Click delete account button to open dialog
      await page.getByTestId('delete-account-button').click();

      // Enter correct password
      await page.getByTestId('delete-password-input').fill(testUser.password);

      // Enter wrong confirmation word
      await page.getByTestId('delete-confirmation-input').fill('WRONG');

      // Click confirm delete button
      await page.getByTestId('delete-account-confirm-button').click();

      // Should see error message
      await expect(
        page.getByText('Please type DELETE to confirm').first(),
      ).toBeVisible();

      // Refresh page and verify still logged in
      await page.reload();
      await expect(page.getByTestId('profile-information-card')).toBeVisible();
    });

    test('User closes delete account dialog', async ({ page }) => {
      // Navigate to profile page
      await page.goto('/profile');

      // Scroll down to find delete account section
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Click delete account button to open dialog
      await page.getByTestId('delete-account-button').click();

      // Close dialog without completing deletion
      await page.getByTestId('delete-account-cancel-button').click();

      // Should still be on profile page and logged in
      await expect(page).toHaveURL('/profile');
      await expect(page.getByTestId('profile-information-card')).toBeVisible();
    });
  });
});

test.describe
  .serial('Passkey', () => {
    let authPage: AuthPage;

    test.beforeEach(async ({ passkeyContext }) => {
      // Reset browser state before each test
      await passkeyContext.page.context().clearCookies();

      authPage = new AuthPage(passkeyContext.page);
    });

    test('cannot login with passkey if email is not registered', async ({
      passkeyContext,
    }) => {
      await authPage.loginWithPasskey();
      // check if we still in login page
      await expect(passkeyContext.page.getByRole('heading')).toContainText(
        'Sign In',
      );
    });

    test('register and login with passkey', async ({ passkeyContext }) => {
      const testUser = generateRandomTestUser();
      await authPage.registerWithPasskey(testUser.email);
      await authPage.isAtChatPage();

      await authPage.logout(testUser.email, testUser.password, true);
      await authPage.loginWithPasskey();
      await authPage.isAtChatPage();

      await authPage.logout(testUser.email, testUser.password, true, true);
    });

    test('cannot register with passkey if email is already registered', async ({
      passkeyContext,
    }) => {
      const testUser = generateRandomTestUser();

      await authPage.register(testUser.email, testUser.password);
      await authPage.isAtChatPage();

      await authPage.logout(testUser.email, testUser.password, true);
      await authPage.registerWithPasskey(testUser.email);
      await passkeyContext.page.waitForTimeout(2000);
      // check if we still in register page
      await expect(passkeyContext.page.getByRole('heading')).toContainText(
        'Sign Up',
      );
    });

    test('should be able to add passkey through profile page', async ({
      passkeyContext,
    }) => {
      const testUser = generateRandomTestUser();
      await authPage.register(testUser.email, testUser.password);
      await authPage.isAtChatPage();

      await passkeyContext.page.goto('/profile');
      await passkeyContext.page.getByTestId('add-passkey-button').click();
      // enter passkey name
      await passkeyContext.page
        .getByRole('textbox', { name: 'Passkey Name' })
        .fill('Test Passkey');
      // click on create passkey
      await passkeyContext.page
        .getByTestId('passkey-name-dialog-create-button')
        .click();
      // check if we are at chat page
      // check if passkey is added
      await expect(
        passkeyContext.page.getByTestId('current-method-Passkey'),
      ).toBeVisible();

      await authPage.logout(testUser.email, testUser.password, true);
      await authPage.loginWithPasskey();
      await authPage.isAtChatPage();
    });

    test('should handle duplicate passkey error when adding multiple passkeys', async ({
      passkeyContext,
    }) => {
      const testUser = generateRandomTestUser();
      await authPage.register(testUser.email, testUser.password);
      await authPage.isAtChatPage();

      await passkeyContext.page.goto('/profile');

      // Add first passkey
      await passkeyContext.page.getByTestId('add-passkey-button').click();
      await passkeyContext.page
        .getByRole('textbox', { name: 'Passkey Name' })
        .fill('Test Passkey 1');
      await passkeyContext.page
        .getByTestId('passkey-name-dialog-create-button')
        .click();

      // Wait for first passkey to be added successfully
      await expect(
        passkeyContext.page.getByTestId('current-method-Passkey'),
      ).toBeVisible();

      // Try to add second passkey with different name
      await passkeyContext.page.getByTestId('add-passkey-button').click();
      await passkeyContext.page
        .getByRole('textbox', { name: 'Passkey Name' })
        .fill('Test Passkey 2');
      await passkeyContext.page
        .getByTestId('passkey-name-dialog-create-button')
        .click();

      // Wait a moment for any potential error messages
      await passkeyContext.page.waitForTimeout(2000);
      // textbox still exists
      await expect(
        passkeyContext.page.getByRole('textbox', { name: 'Passkey Name' }),
      ).toBeVisible();
    });
  });
