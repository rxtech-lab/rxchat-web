import { expect, test } from '../fixtures';
import { ChatPage } from '../pages/chat';
import { ArtifactPage } from '../pages/artifact';

test.describe
  .serial('Artifacts activity', () => {
    let chatPage: ChatPage;
    let artifactPage: ArtifactPage;

    test.beforeEach(async ({ adaContext }) => {
      chatPage = new ChatPage(adaContext.page);
      artifactPage = new ArtifactPage(adaContext.page);

      await chatPage.createNewChat();

      await chatPage.chooseModelFromSelector('chat-model-reasoning');
      await adaContext.page.waitForTimeout(1500);
      const currentModel = await chatPage.getSelectedModel();
      expect(currentModel).toBe('Test reasoning Model');
    });

    test('Create a text artifact', async ({ adaContext }) => {
      await chatPage.createNewChat();

      await chatPage.sendUserMessage(
        'Help me write an essay about Silicon Valley',
      );

      await artifactPage.isGenerationComplete();

      expect(artifactPage.artifact).toBeVisible();

      const assistantMessage = await chatPage.getRecentAssistantMessage();
      expect(assistantMessage.content).toBe(
        'A document was created and is now visible to the user.',
      );

      await chatPage.hasChatIdInUrl();
    });

    test('Toggle artifact visibility', async ({ adaContext }) => {
      await chatPage.createNewChat();

      await chatPage.sendUserMessage(
        'Help me write an essay about Silicon Valley',
      );

      await artifactPage.isGenerationComplete();

      expect(artifactPage.artifact).toBeVisible();

      const assistantMessage = await chatPage.getRecentAssistantMessage();
      expect(assistantMessage.content).toBe(
        'A document was created and is now visible to the user.',
      );

      await artifactPage.closeArtifact();
      await chatPage.isElementNotVisible('artifact');
    });

    test('Send follow up message after generation', async ({ adaContext }) => {
      await chatPage.createNewChat();

      await chatPage.sendUserMessage(
        'Help me write an essay about Silicon Valley',
      );
      await artifactPage.isGenerationComplete();

      expect(artifactPage.artifact).toBeVisible();

      const assistantMessage = await chatPage.getRecentAssistantMessage();
      expect(assistantMessage.content).toBe(
        'A document was created and is now visible to the user.',
      );

      await artifactPage.sendUserMessage('Thanks!');
      await artifactPage.isGenerationComplete();

      const secondAssistantMessage = await chatPage.getRecentAssistantMessage();
      expect(secondAssistantMessage.content).toBe("You're welcome!");
    });
  });
