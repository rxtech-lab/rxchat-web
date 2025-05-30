/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { MessageEditor } from './message-editor';
import type { UIMessage } from 'ai';

// Mock the deleteTrailingMessages function
jest.mock('@/app/(chat)/actions', () => ({
  deleteTrailingMessages: jest.fn(() => Promise.resolve()),
}));

describe('MessageEditor', () => {
  it('should render message with content', async () => {
    const message: UIMessage = {
      id: '1',
      role: 'user',
      content: 'Hello, world!',
      parts: [{ type: 'text', text: 'Hello, world!' }],
    };
    render(
      <MessageEditor
        message={message}
        setMode={() => {}}
        setMessages={() => {}}
        reload={() => Promise.resolve(null)}
      />,
    );

    // get message editor textarea
    const textarea = screen.getByTestId('message-editor');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('Hello, world!');
  });

  it('should render message with content from parts array', async () => {
    const message: UIMessage = {
      id: '1',
      role: 'user',
      content: '',
      parts: [{ type: 'text', text: 'Hello, world!' }],
    };
    render(
      <MessageEditor
        message={message}
        setMode={() => {}}
        setMessages={() => {}}
        reload={() => Promise.resolve(null)}
      />,
    );

    // get message editor textarea
    const textarea = screen.getByTestId('message-editor');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('Hello, world!');
  });
});
