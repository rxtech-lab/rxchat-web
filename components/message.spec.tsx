/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { PreviewMessage } from './message';
import type { Vote } from '../lib/db/schema';
import type { UIMessage } from 'ai';

// Mock dependencies
jest.mock('@/app/(chat)/actions', () => ({
  deleteTrailingMessages: jest.fn(() => Promise.resolve()),
}));

// Mock react-syntax-highlighter to avoid ES module issues
jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: string }) => <pre>{children}</pre>,
}));

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vs: {},
}));

// Mock CodeView component
jest.mock('./code-view', () => ({
  CodeView: ({ code }: { code: string }) => (
    <div data-testid="code-view">{code}</div>
  ),
}));

// Mock other components to keep test focused
jest.mock('./markdown', () => ({
  Markdown: ({ children }: { children: string }) => <div>{children}</div>,
}));

jest.mock('./spiner', () => ({
  __esModule: true,
  default: () => <div data-testid="spinner">Loading...</div>,
}));

jest.mock('./document', () => ({
  DocumentToolCall: () => (
    <div data-testid="document-tool-call">Document Tool Call</div>
  ),
  DocumentToolResult: () => (
    <div data-testid="document-tool-result">Document Tool Result</div>
  ),
}));

jest.mock('./document-preview', () => ({
  DocumentPreview: () => (
    <div data-testid="document-preview">Document Preview</div>
  ),
}));

jest.mock('./document-search-result', () => ({
  DocumentSearchResult: () => (
    <div data-testid="document-search-result">Document Search Result</div>
  ),
}));

jest.mock('./message-actions', () => ({
  MessageActions: () => (
    <div data-testid="message-actions">Message Actions</div>
  ),
}));

jest.mock('./message-editor', () => ({
  MessageEditor: () => <div data-testid="message-editor">Message Editor</div>,
}));

jest.mock('./message-reasoning', () => ({
  MessageReasoning: () => (
    <div data-testid="message-reasoning">Message Reasoning</div>
  ),
}));

jest.mock('./preview-attachment', () => ({
  PreviewAttachment: () => (
    <div data-testid="preview-attachment">Preview Attachment</div>
  ),
}));

describe('PreviewMessage - Tool Identifier Support', () => {
  const mockProps = {
    chatId: 'test-chat-id',
    vote: undefined as Vote | undefined,
    isLoading: false,
    setMessages: jest.fn(),
    reload: jest.fn(() => Promise.resolve(null)),
    isReadonly: false,
    requiresScrollPadding: false,
    status: 'ready' as const,
  };

  it('should render tool name without identifier', () => {
    const message: UIMessage = {
      id: '1',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolCallId: 'tool-1',
            toolName: 'useTool',
            state: 'result',
            args: { query: 'test' },
            result: { data: 'result' },
          } as any,
        },
      ],
    };

    render(<PreviewMessage {...mockProps} message={message} />);

    // Should display just the tool name when no identifier is present
    expect(screen.getByText('useTool')).toBeInTheDocument();
  });

  it('should render tool name with identifier when identifier is present', () => {
    const message: UIMessage = {
      id: '1',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolCallId: 'tool-1',
            toolName: 'useTool',
            identifier: 'crypto-data',
            state: 'result',
            args: { query: 'test' },
            result: { data: 'result' },
          } as any,
        },
      ],
    };

    render(<PreviewMessage {...mockProps} message={message} />);

    // Should display tool name with identifier in format "toolName - identifier"
    expect(screen.getByText('useTool - crypto-data')).toBeInTheDocument();
  });
});
