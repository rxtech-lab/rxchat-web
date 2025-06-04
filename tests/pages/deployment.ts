import { expect, type Page } from '@playwright/test';
import path from 'node:path';

/**
 * Page object for deployment testing that handles login, model selection, and chat operations
 */
export class DeploymentPage {
  constructor(
    private page: Page,
    private baseUrl: string,
  ) {}

  // Getters for common elements
  public get emailInput() {
    return this.page.getByRole('textbox', { name: 'Email Address' });
  }

  public get passwordInput() {
    return this.page.getByRole('textbox', { name: 'Password' });
  }

  public get signInButton() {
    return this.page.getByRole('button', { name: 'Sign in', exact: true });
  }

  public get multimodalInput() {
    return this.page.getByTestId('multimodal-input');
  }

  public get sendButton() {
    return this.page.getByTestId('send-button');
  }

  public get modelSelector() {
    return this.page.getByTestId('model-selector');
  }

  public get attachmentsButton() {
    return this.page.getByTestId('attachments-button');
  }

  public get inputAttachmentPreview() {
    return this.page.getByTestId('input-attachment-preview');
  }

  public get assistantMessages() {
    return this.page.getByTestId('message-assistant');
  }

  /**
   * Navigate to the login page
   */
  async goToLogin(): Promise<void> {
    await this.page.goto(`${this.baseUrl}/login`);
  }

  /**
   * Perform login with provided credentials
   * @param username - The username/email to login with
   * @param password - The password to login with
   */
  async login(username: string, password: string): Promise<void> {
    await this.emailInput.click();
    await this.emailInput.fill(username);
    await this.passwordInput.click();
    await this.passwordInput.fill(password);
    await this.signInButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Login using environment variables for credentials
   */
  async loginWithEnvCredentials(): Promise<void> {
    const username = process.env.TEST_USER_USERNAME;
    const password = process.env.TEST_USER_PASSWORD;

    if (!username || !password) {
      throw new Error(
        'TEST_USER_USERNAME and TEST_USER_PASSWORD environment variables must be set',
      );
    }

    await this.login(username, password);
  }

  /**
   * Verify that the chat interface is visible after login
   */
  async verifyLoggedIn(): Promise<void> {
    expect(this.multimodalInput).toBeVisible();
    expect(this.modelSelector).toBeVisible();
  }

  /**
   * Select a model by searching and clicking on it
   * @param modelSearchTerm - The search term to find the model
   * @param modelId - The specific model ID to select
   */
  async selectModel(modelSearchTerm: string, modelId: string): Promise<void> {
    await this.modelSelector.click();
    await this.page.waitForTimeout(1000);

    const searchInput = this.page.getByPlaceholder('Search models...');
    await searchInput.click();
    await this.page.waitForTimeout(1000);
    await searchInput.fill(modelSearchTerm);
    await this.page.waitForTimeout(1000);

    await this.page.getByTestId(`model-selector-item-${modelId}`).click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * Send a text message in the chat
   * @param message - The message to send
   * @param waitTime - Time to wait after sending (default: 10000ms)
   */
  async sendMessage(message: string, waitTime = 10000): Promise<void> {
    await this.multimodalInput.click();
    await this.multimodalInput.fill(message);
    await this.sendButton.click();
    await this.page.waitForTimeout(waitTime);
  }

  /**
   * Attach a file to the chat input
   * @param filePath - Relative path to the file to attach (from __dirname)
   * @param waitTime - Time to wait after attachment (default: 8000ms)
   */
  async attachFile(filePath: string, waitTime = 8000): Promise<void> {
    const fileChooserPromise = this.page.waitForEvent('filechooser');
    await this.attachmentsButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(
      path.join(__dirname, '..', '..', 'deployment-e2e', filePath),
    );
    await this.page.waitForTimeout(waitTime);
  }

  /**
   * Verify that a file attachment preview is visible
   */
  async verifyAttachmentPreview(): Promise<void> {
    expect(await this.inputAttachmentPreview).toBeVisible();
  }

  /**
   * Wait for and verify assistant message count
   * @param expectedCount - The expected number of assistant messages
   * @param timeout - Timeout for the expectation (default: 30000ms)
   */
  async waitForAssistantMessages(
    expectedCount: number,
    timeout = 30000,
  ): Promise<void> {
    expect(this.assistantMessages).toHaveCount(expectedCount, { timeout });
  }

  /**
   * Complete flow: login, select model, and send initial message
   * @param modelSearchTerm - Search term for model selection
   * @param modelId - Specific model ID to select
   */
  async completeInitialFlow(
    modelSearchTerm: string,
    modelId: string,
  ): Promise<void> {
    await this.goToLogin();
    await this.loginWithEnvCredentials();
    await this.verifyLoggedIn();
    await this.selectModel(modelSearchTerm, modelId);
  }

  /**
   * Send a message with file attachment
   * @param filePath - Path to the file to attach
   * @param message - Message to send with the attachment
   * @param waitTime - Time to wait after sending (default: 20000ms)
   */
  async sendMessageWithAttachment(
    filePath: string,
    message: string,
    waitTime = 20000,
  ): Promise<void> {
    await this.attachFile(filePath);
    await this.verifyAttachmentPreview();
    await this.sendMessage(message, waitTime);
  }
}
