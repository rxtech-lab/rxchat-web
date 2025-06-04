import { test } from '../tests/fixtures';
import { DeploymentPage } from '../tests/pages/deployment';

test.describe('chat', () => {
  let deploymentPage: DeploymentPage;

  test.beforeEach(async ({ realworldContext }) => {
    const { page, baseUrl } = realworldContext;
    deploymentPage = new DeploymentPage(page, baseUrl);
  });

  test('login and chat with pdf', async () => {
    // Complete initial login and chat flow
    await deploymentPage.completeInitialFlow(
      'gemini',
      'google/gemini-2.5-flash-preview-05-20',
    );

    await deploymentPage.sendMessage('Hi~');
    await deploymentPage.waitForAssistantMessages(1);

    // Send message with PDF attachment
    await deploymentPage.sendMessageWithAttachment(
      'mcp.pdf',
      'Waht is in this pdf?',
    );

    // Verify we have 2 assistant messages
    await deploymentPage.waitForAssistantMessages(2);
  });

  test('invoke tools ', async () => {
    // Complete initial login and chat flow
    await deploymentPage.completeInitialFlow(
      'gemini',
      'google/gemini-2.5-pro-preview',
    );

    await deploymentPage.sendMessage('What is the current bitcoin trend?');
    await deploymentPage.waitForAssistantMessages(1, 20000);

    await deploymentPage.sendMessage('Summarize the current bitcoin trend');
    // Verify we have 2 assistant messages
    await deploymentPage.waitForAssistantMessages(2, 20000);
  });
});
