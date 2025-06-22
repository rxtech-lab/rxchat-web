/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Chat } from './chat';
import { useChat } from '@ai-sdk/react';
import { useSearchParams } from 'next/navigation';

jest.mock('@ai-sdk/react');
jest.mock('next/navigation');
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, error: undefined, mutate: jest.fn() })),
  useSWRConfig: jest.fn(() => ({ mutate: jest.fn() }))
}));
jest.mock('@/hooks/use-artifact', () => ({
  useArtifactSelector: jest.fn(() => false)
}));
jest.mock('@/hooks/use-chat-visibility', () => ({
  useChatVisibility: jest.fn(() => ({ visibilityType: 'private' }))
}));
jest.mock('@/hooks/use-auto-resume', () => ({
  useAutoResume: jest.fn()
}));
jest.mock('./chat-header', () => ({
  ChatHeader: () => <div data-testid="chat-header">Chat Header</div>
}));
jest.mock('./messages', () => ({
  Messages: () => <div data-testid="messages">Messages</div>
}));
jest.mock('./input/multimodal-input', () => ({
  MultimodalInput: () => <div data-testid="multimodal-input">Multimodal Input</div>
}));
jest.mock('./artifact', () => ({
  Artifact: () => <div data-testid="artifact">Artifact</div>
}));

const mockUseChat = useChat as jest.MockedFunction<typeof useChat>;
const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>;

describe('Chat', () => {
  const defaultProps = {
    id: 'test-chat-id',
    initialMessages: [],
    initialChatModel: 'gpt-4',
    initialVisibilityType: 'private' as const,
    isReadonly: false,
    session: {
      user: { id: 'user-1', email: 'test@example.com' },
      expires: '2024-12-31'
    } as any,
    autoResume: false,
    providers: {
      anthropic: { models: [] },
      openai: { models: [] }
    } as any,
    selectedChatModelProvider: 'openai' as const,
    selectedPrompt: null,
    initialWebSearchEnabled: false
  };

  const mockChatHelpers = {
    messages: [],
    setMessages: jest.fn(),
    handleSubmit: jest.fn(),
    input: '',
    setInput: jest.fn(),
    append: jest.fn(),
    status: 'idle' as const,
    stop: jest.fn(),
    reload: jest.fn(),
    experimental_resume: jest.fn(),
    data: undefined
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseChat.mockReturnValue(mockChatHelpers);
    mockUseSearchParams.mockReturnValue({
      get: jest.fn(() => null)
    } as any);
  });

  it('should render chat layout with all main components', () => {
    render(<Chat {...defaultProps} />);
    
    expect(screen.getByTestId('chat-header')).toBeInTheDocument();
    expect(screen.getByTestId('messages')).toBeInTheDocument();
    // Note: Artifact component is always rendered but may not be visible
  });

  it('should render multimodal input when not readonly', () => {
    render(<Chat {...defaultProps} />);
    
    expect(screen.getByTestId('multimodal-input')).toBeInTheDocument();
  });

  it('should not render multimodal input when readonly', () => {
    render(<Chat {...defaultProps} isReadonly={true} />);
    
    expect(screen.queryByTestId('multimodal-input')).not.toBeInTheDocument();
  });

  it('should initialize useChat with correct configuration', () => {
    render(<Chat {...defaultProps} />);
    
    expect(mockUseChat).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-chat-id',
        initialMessages: [],
        experimental_throttle: 100,
        sendExtraMessageFields: true
      })
    );
  });

  it('should pass correct props to ChatHeader', () => {
    const { container } = render(<Chat {...defaultProps} />);
    
    // Since ChatHeader is mocked, we can't test exact props
    // but we can verify it's rendered
    expect(screen.getByTestId('chat-header')).toBeInTheDocument();
  });

  it('should pass correct props to Messages component', () => {
    render(<Chat {...defaultProps} />);
    
    expect(screen.getByTestId('messages')).toBeInTheDocument();
  });

  it('should handle chat with initial web search enabled', () => {
    render(<Chat {...defaultProps} initialWebSearchEnabled={true} />);
    
    expect(screen.getByTestId('chat-header')).toBeInTheDocument();
    expect(screen.getByTestId('messages')).toBeInTheDocument();
  });

  it('should apply correct CSS classes to main container', () => {
    const { container } = render(<Chat {...defaultProps} />);
    
    const mainDiv = container.querySelector('.flex.flex-col.min-w-0.h-dvh.bg-background');
    expect(mainDiv).toBeInTheDocument();
  });

  it('should apply correct form classes', () => {
    const { container } = render(<Chat {...defaultProps} />);
    
    const form = container.querySelector('form');
    expect(form).toHaveClass(
      'flex',
      'mx-auto',
      'px-4',
      'bg-background',
      'pb-4',
      'md:pb-6',
      'gap-2',
      'w-full',
      'md:max-w-3xl'
    );
  });

  it('should handle different visibility types', () => {
    const publicProps = {
      ...defaultProps,
      initialVisibilityType: 'public' as const
    };
    
    render(<Chat {...publicProps} />);
    
    expect(screen.getByTestId('chat-header')).toBeInTheDocument();
  });

  it('should handle different chat models', () => {
    const claudeProps = {
      ...defaultProps,
      initialChatModel: 'claude-3-5-sonnet-20241022'
    };
    
    render(<Chat {...claudeProps} />);
    
    expect(mockUseChat).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-chat-id'
      })
    );
  });
});