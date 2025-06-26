import type { Page } from '@playwright/test';
import { expect } from '../fixtures';

export class AuthPage {
  constructor(private page: Page) {}

  async gotoLogin() {
    await this.page.goto('/login');
    await expect(this.page.getByRole('heading')).toContainText('Sign In');
  }

  async gotoRegister() {
    await this.page.goto('/register');
    await expect(this.page.getByRole('heading')).toContainText('Sign Up');
  }

  async registerWithPasskey(email: string) {
    await this.page.goto('/register');
    await this.page.getByRole('textbox', { name: 'Email' }).fill(email);
    await this.page.getByTestId('passkey-register-button').click();
  }

  async loginWithPasskey() {
    await this.page.goto('/login');
    await this.page.getByTestId('passkey-login-button').click();
  }

  async isAtChatPage() {
    await this.page.waitForURL('/');
    await expect(this.page.getByTestId('multimodal-input')).toBeVisible();
  }

  async register(email: string, password: string) {
    await this.gotoRegister();
    await this.page.getByPlaceholder('user@acme.com').click();
    await this.page.getByPlaceholder('user@acme.com').fill(email);

    // click on continue
    await this.page.getByRole('button', { name: 'Continue' }).click();

    await this.page.getByLabel('Password').first().click();
    await this.page.getByLabel('Password').first().fill(password);
    await this.page.getByLabel('Confirm Password').first().click();
    await this.page.getByLabel('Confirm Password').first().fill(password);
    await this.page.getByRole('button', { name: 'Sign Up' }).click();
  }

  async login(email: string, password: string) {
    await this.gotoLogin();
    await this.page.getByPlaceholder('user@acme.com').click();
    await this.page.getByPlaceholder('user@acme.com').fill(email);
    await this.page.getByLabel('Password').click();
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign In' }).first().click();
  }

  async logout(
    email: string,
    password: string,
    skipLogin = false,
    skipSidebar = false,
  ) {
    if (!skipLogin) {
      await this.login(email, password);
      await this.page.waitForURL('/');
    }

    if (!skipSidebar) {
      await this.openSidebar();
    }

    const userNavButton = this.page.getByTestId('user-nav-button');
    await expect(userNavButton).toBeVisible();

    await userNavButton.click();
    const userNavMenu = this.page.getByTestId('user-nav-menu');
    await expect(userNavMenu).toBeVisible();

    const authMenuItem = this.page.getByTestId('user-nav-item-auth');
    await expect(authMenuItem).toContainText('Sign out');

    await authMenuItem.click();

    const signIn = this.page.getByRole('heading', { name: 'Sign In' });
    await expect(signIn).toBeVisible();
  }

  async expectToastToContain(text: string) {
    await expect(this.page.getByTestId('toast')).toContainText(text);
  }

  async openSidebar() {
    const sidebarToggleButton = this.page.getByTestId('sidebar-toggle-button');
    await sidebarToggleButton.click();
  }
}
