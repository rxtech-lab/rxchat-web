import { expect } from '@playwright/test';
import { test } from '../tests/fixtures';
import path from 'node:path';

test.describe('chat', () => {
  test('login and chat with pdf', async ({ realworldContext }) => {
    const { page, baseUrl } = realworldContext;

    await page.goto(`${baseUrl}/login`);
    await page.getByRole('textbox', { name: 'Email Address' }).click();
    await page
      .getByRole('textbox', { name: 'Email Address' })
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      .fill(process.env.TEST_USER_USERNAME!);
    await page.getByText('Password').click();
    await page
      .getByRole('textbox', { name: 'Password' })
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      .fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForLoadState('networkidle');
    expect(page.getByTestId('multimodal-input')).toBeVisible();
    expect(page.getByTestId('model-selector')).toBeVisible();
    await page.getByTestId('model-selector').click();
    await page.waitForTimeout(1000);

    await page.getByPlaceholder('Search models...').click();
    await page.waitForTimeout(1000);
    await page.getByPlaceholder('Search models...').fill('gemini');
    await page.waitForTimeout(1000);
    await page
      .getByTestId('model-selector-item-google/gemini-2.5-flash-preview-05-20')
      .click();
    await page.waitForTimeout(1000);
    await page.getByTestId('multimodal-input').click();
    await page.getByTestId('multimodal-input').fill('Hi~');
    await page.getByTestId('send-button').click();
    await page.waitForTimeout(10000);

    // wait for the message to be sent
    expect(page.getByTestId('message-assistant')).toHaveCount(1);

    // file picker
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('attachments-button').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'mcp.pdf'));

    await page.waitForTimeout(8000);
    expect(await page.getByTestId('input-attachment-preview')).toBeVisible();
    await page.getByTestId('multimodal-input').click();
    await page.getByTestId('multimodal-input').fill('Waht is in this pdf?');
    await page.getByTestId('send-button').click();
    await page.waitForTimeout(20000);

    expect(page.getByTestId('message-assistant')).toHaveCount(2, {
      timeout: 30000,
    });
  });
});
