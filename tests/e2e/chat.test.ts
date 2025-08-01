import { ChatPage } from '../pages/chat';
import { test, expect } from '../fixtures';

test.describe('Chat activity', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ adaContext }) => {
    chatPage = new ChatPage(adaContext.page);
    await chatPage.createNewChat();

    await chatPage.chooseModelFromSelector('chat-model');
    await adaContext.page.waitForTimeout(1500);
    const currentModel = await chatPage.getSelectedModel();
    expect(currentModel).toBe('Test Model');
  });

  test('Show mentions menu when typing @', async ({ adaContext }) => {
    const input = adaContext.page.getByTestId('multimodal-input');
    await input.click();
    await input.fill('@');
    await adaContext.page.waitForTimeout(1000);
    const mentionsMenu = adaContext.page.getByTestId('mentions-menu');
    expect(mentionsMenu).toBeVisible();

    const toolItem = adaContext.page.getByText('Tools', { exact: true });
    expect(toolItem).toBeVisible();

    // hit enter to select the tool
    await input.press('Enter');
    await adaContext.page.waitForTimeout(1000);
    expect(toolItem).not.toBeVisible();

    await adaContext.page.keyboard.press('Escape');
    await adaContext.page.waitForTimeout(1000);
    expect(toolItem).toBeVisible();

    // press esc again
    await adaContext.page.keyboard.press('Escape');
    await adaContext.page.waitForTimeout(1000);
    expect(mentionsMenu).not.toBeVisible();
  });

  test('Send a user message and receive response', async ({ adaContext }) => {
    await chatPage.sendUserMessage('Why is grass green?');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toContain("It's just green duh!");
  });

  test('Redirect to /chat/:id after submitting message', async ({
    adaContext,
  }) => {
    await chatPage.sendUserMessage('Why is grass green?');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toContain("It's just green duh!");
    await chatPage.hasChatIdInUrl();
  });

  test('Send a user message from suggestion', async ({ adaContext }) => {
    await chatPage.sendUserMessageFromSuggestion();
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toContain(
      'With Next.js, you can ship fast!',
    );
  });

  test('Toggle between send/stop button based on activity', async ({
    adaContext,
  }) => {
    await expect(chatPage.sendButton).toBeVisible();
    await expect(chatPage.sendButton).toBeDisabled();

    await chatPage.sendUserMessage('Why is grass green?');

    await expect(chatPage.sendButton).not.toBeVisible();
    await expect(chatPage.stopButton).toBeVisible();

    await chatPage.isGenerationComplete();

    await expect(chatPage.stopButton).not.toBeVisible();
    await expect(chatPage.sendButton).toBeVisible();
  });

  test('Stop generation during submission', async ({ adaContext }) => {
    await chatPage.sendUserMessage('Why is grass green?');
    await expect(chatPage.stopButton).toBeVisible();
    await chatPage.stopButton.click();
    await expect(chatPage.sendButton).toBeVisible();
  });

  test('Edit user message and resubmit', async ({ adaContext }) => {
    await chatPage.sendUserMessage('Why is grass green?');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toContain("It's just green duh!");

    const userMessage = await chatPage.getRecentUserMessage();
    await userMessage.edit('Why is the sky blue?');

    await chatPage.isGenerationComplete();

    const updatedAssistantMessage = await chatPage.getRecentAssistantMessage();
    expect(updatedAssistantMessage.content).toContain("It's just blue duh!");
  });

  test('Message editor initializes with correct content from parts array', async ({
    adaContext,
  }) => {
    const originalMessage = 'Test message for editor initialization';
    await chatPage.sendUserMessage(originalMessage);
    await chatPage.isGenerationComplete();

    const userMessage = await chatPage.getRecentUserMessage();

    // Click edit button to open the editor
    await userMessage.element.hover();
    const editButton = userMessage.element.getByTestId('message-edit-button');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Verify the editor textarea contains the original message content
    const messageEditor = userMessage.element.getByTestId('message-editor');
    await expect(messageEditor).toBeVisible();

    const editorValue = await messageEditor.inputValue();
    expect(editorValue).toBe(originalMessage);

    // Cancel the edit to clean up
    const cancelButton = userMessage.element.getByRole('button', {
      name: 'Cancel',
    });
    await cancelButton.click();
  });

  test('Hide suggested actions after sending message', async ({
    adaContext,
  }) => {
    await chatPage.isElementVisible('suggested-actions');
    await chatPage.sendUserMessageFromSuggestion();
    await chatPage.isElementNotVisible('suggested-actions');
  });

  test.skip('Upload file and send image attachment with message', async ({
    adaContext,
  }) => {
    await chatPage.addImageAttachment();

    await chatPage.isElementVisible('attachments-preview');
    await chatPage.isElementVisible('input-attachment-loader');
    await chatPage.isElementNotVisible('input-attachment-loader');

    await chatPage.sendUserMessage('Who painted this?');

    const userMessage = await chatPage.getRecentUserMessage();
    expect(userMessage.attachments).toHaveLength(1);

    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toBe('This painting is by Monet!');
  });

  test('Upvote message', async ({ adaContext }) => {
    await chatPage.sendUserMessage('Why is the sky blue?');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    await assistantMessage.upvote();
    await chatPage.isVoteComplete();
  });

  test('Downvote message', async ({ adaContext }) => {
    await chatPage.sendUserMessage('Why is the sky blue?');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    await assistantMessage.downvote();
    await chatPage.isVoteComplete();
  });

  test('Update vote', async ({ adaContext }) => {
    await chatPage.sendUserMessage('Why is the sky blue?');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    await assistantMessage.upvote();
    await chatPage.isVoteComplete();

    await assistantMessage.downvote();
    await chatPage.isVoteComplete();
  });

  test('Create message from url query', async ({ adaContext }) => {
    await adaContext.page.goto('/?query=Why is the sky blue?');

    await chatPage.isGenerationComplete();

    const userMessage = await chatPage.getRecentUserMessage();
    expect(userMessage.content).toBe('Why is the sky blue?');

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toContain("It's just blue duh!");
  });

  // related to issue: https://github.com/rxtech-lab/rxchat-web/issues/53
  test('User message persists after model error and page refresh', async ({
    adaContext,
  }) => {
    // Send a message that will trigger an error
    await chatPage.sendUserMessage('Trigger an error please');
    await adaContext.page.waitForTimeout(1000);

    // Refresh the page
    await adaContext.page.reload();
    await adaContext.page.waitForTimeout(1000);

    // Send a message that will trigger an error
    await chatPage.sendUserMessage('Hi');
    await adaContext.page.waitForTimeout(1000);

    // Check that the user message is still visible after refresh
    const userMessage = await chatPage.getRecentUserMessage();
    expect(userMessage.content).toBe('Hi');
  });

  test('User message persists after page refresh', async ({ adaContext }) => {
    // Send a message that will trigger an error
    await chatPage.sendUserMessage('Why is the sky blue?');
    await chatPage.isGenerationComplete();

    await adaContext.page.waitForTimeout(1000);

    // Refresh the page
    await adaContext.page.reload();
    await adaContext.page.waitForTimeout(1000);

    // Check that the user message is still visible after refresh
    const userMessage = await chatPage.getRecentUserMessage();
    expect(userMessage.content).toBe('Why is the sky blue?');

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toContain("It's just blue duh!");
  });

  test('Handle tool call error gracefully', async ({ adaContext }) => {
    // Send a message that will trigger a tool call error
    await chatPage.sendUserMessage('Trigger a tool call error please');
    await chatPage.isGenerationComplete();

    // send message again to check if the error is handled gracefully
    await chatPage.sendUserMessage('Hi');
    await chatPage.isGenerationComplete();

    await adaContext.page.waitForTimeout(1000);
    const userMessage = await chatPage.getRecentUserMessage();
    expect(userMessage.content).toBe('Hi');
  });

  test.skip('auto-scrolls to bottom after submitting new messages', async ({
    adaContext,
  }) => {
    await chatPage.sendMultipleMessages(5, (i) => `filling message #${i}`);
    await chatPage.waitForScrollToBottom();
  });

  test.skip('scroll button appears when user scrolls up, hides on click', async ({
    adaContext,
  }) => {
    await chatPage.sendMultipleMessages(5, (i) => `filling message #${i}`);
    await expect(chatPage.scrollToBottomButton).not.toBeVisible();

    await chatPage.scrollToTop();
    await expect(chatPage.scrollToBottomButton).toBeVisible();

    await chatPage.scrollToBottomButton.click();
    await chatPage.waitForScrollToBottom();
    await expect(chatPage.scrollToBottomButton).not.toBeVisible();
  });
});
