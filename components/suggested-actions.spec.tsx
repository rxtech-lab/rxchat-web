/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SuggestedActions } from './suggested-actions';

// Mock window.history
const mockReplaceState = jest.fn();
Object.defineProperty(window, 'history', {
  value: { replaceState: mockReplaceState },
  writable: true,
});

describe('SuggestedActions', () => {
  const mockAppend = jest.fn();

  const defaultProps = {
    chatId: 'test-chat-id',
    append: mockAppend,
    selectedVisibilityType: 'private' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render suggested actions container', () => {
    render(<SuggestedActions {...defaultProps} />);

    expect(screen.getByTestId('suggested-actions')).toBeInTheDocument();
    expect(screen.getByTestId('suggested-actions')).toHaveClass(
      'grid',
      'sm:grid-cols-2',
      'gap-2',
      'w-full',
    );
  });

  it('should render all four suggested action buttons', () => {
    render(<SuggestedActions {...defaultProps} />);

    expect(screen.getByText('What are the advantages')).toBeInTheDocument();
    expect(screen.getByText('of using Next.js?')).toBeInTheDocument();

    expect(screen.getByText('Write code to')).toBeInTheDocument();
    expect(
      screen.getByText("demonstrate djikstra's algorithm"),
    ).toBeInTheDocument();

    expect(screen.getByText('Help me write an essay')).toBeInTheDocument();
    expect(screen.getByText('about silicon valley')).toBeInTheDocument();

    expect(screen.getByText('What is the weather')).toBeInTheDocument();
    expect(screen.getByText('in San Francisco?')).toBeInTheDocument();
  });

  it('should call append with correct message when Next.js button is clicked', async () => {
    render(<SuggestedActions {...defaultProps} />);

    const nextjsButton = screen
      .getByText('What are the advantages')
      .closest('button');
    fireEvent.click(nextjsButton!);

    expect(mockReplaceState).toHaveBeenCalledWith({}, '', '/chat/test-chat-id');
    expect(mockAppend).toHaveBeenCalledWith({
      role: 'user',
      content: 'What are the advantages of using Next.js?',
    });
  });

  it('should call append with correct message when algorithm button is clicked', async () => {
    render(<SuggestedActions {...defaultProps} />);

    const algorithmButton = screen.getByText('Write code to').closest('button');
    fireEvent.click(algorithmButton!);

    expect(mockReplaceState).toHaveBeenCalledWith({}, '', '/chat/test-chat-id');
    expect(mockAppend).toHaveBeenCalledWith({
      role: 'user',
      content: "Write code to demonstrate djikstra's algorithm",
    });
  });

  it('should call append with correct message when essay button is clicked', async () => {
    render(<SuggestedActions {...defaultProps} />);

    const essayButton = screen
      .getByText('Help me write an essay')
      .closest('button');
    fireEvent.click(essayButton!);

    expect(mockReplaceState).toHaveBeenCalledWith({}, '', '/chat/test-chat-id');
    expect(mockAppend).toHaveBeenCalledWith({
      role: 'user',
      content: 'Help me write an essay about silicon valley',
    });
  });

  it('should call append with correct message when weather button is clicked', async () => {
    render(<SuggestedActions {...defaultProps} />);

    const weatherButton = screen
      .getByText('What is the weather')
      .closest('button');
    fireEvent.click(weatherButton!);

    expect(mockReplaceState).toHaveBeenCalledWith({}, '', '/chat/test-chat-id');
    expect(mockAppend).toHaveBeenCalledWith({
      role: 'user',
      content: 'What is the weather in San Francisco?',
    });
  });

  it('should apply correct CSS classes to buttons', () => {
    render(<SuggestedActions {...defaultProps} />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toHaveClass(
        'text-left',
        'border',
        'rounded-xl',
        'px-4',
        'py-3.5',
        'text-sm',
        'flex-1',
        'gap-1',
        'sm:flex-col',
        'w-full',
        'h-auto',
        'justify-start',
        'items-start',
      );
    });
  });

  it('should have correct responsive visibility classes', () => {
    const { container } = render(<SuggestedActions {...defaultProps} />);

    // First two buttons should always be visible
    const firstTwoMotionDivs = container.querySelectorAll('.block');
    expect(firstTwoMotionDivs.length).toBeGreaterThanOrEqual(2);

    // Last two buttons should be hidden on mobile
    const hiddenOnMobile = container.querySelectorAll('.hidden.sm\\:block');
    expect(hiddenOnMobile.length).toBe(2);
  });

  it('should render button structure with title and label', () => {
    render(<SuggestedActions {...defaultProps} />);

    const titleElements = screen.getAllByText(
      /^(What are the advantages|Write code to|Help me write an essay|What is the weather)$/,
    );
    const labelElements = screen.getAllByText(
      /^(of using Next\.js\?|demonstrate djikstra's algorithm|about silicon valley|in San Francisco\?)$/,
    );

    expect(titleElements).toHaveLength(4);
    expect(labelElements).toHaveLength(4);

    titleElements.forEach((title) => {
      expect(title).toHaveClass('font-medium');
    });

    labelElements.forEach((label) => {
      expect(label).toHaveClass('text-muted-foreground');
    });
  });

  it('should handle different chat IDs correctly', () => {
    const differentChatProps = {
      ...defaultProps,
      chatId: 'different-chat-id',
    };

    render(<SuggestedActions {...differentChatProps} />);

    const firstButton = screen
      .getByText('What are the advantages')
      .closest('button');
    fireEvent.click(firstButton!);

    expect(mockReplaceState).toHaveBeenCalledWith(
      {},
      '',
      '/chat/different-chat-id',
    );
  });

  it('should handle different visibility types', () => {
    const publicVisibilityProps = {
      ...defaultProps,
      selectedVisibilityType: 'public' as const,
    };

    render(<SuggestedActions {...publicVisibilityProps} />);

    // Should still render all buttons regardless of visibility type
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });
});
