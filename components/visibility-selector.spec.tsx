/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VisibilitySelector } from './visibility-selector';

jest.mock('@/hooks/use-chat-visibility', () => ({
  useChatVisibility: jest.fn(() => ({
    visibilityType: 'private',
    setVisibilityType: jest.fn(),
  })),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('VisibilitySelector', () => {
  const defaultProps = {
    chatId: 'test-chat-id',
    selectedVisibilityType: 'private' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render visibility selector button', () => {
    render(<VisibilitySelector {...defaultProps} />);

    expect(screen.getByTestId('visibility-selector')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
  });

  it('should show correct icon and label for private visibility', () => {
    render(
      <VisibilitySelector {...defaultProps} selectedVisibilityType="private" />,
    );

    expect(screen.getByText('Private')).toBeInTheDocument();
    // The lock icon should be rendered (though we can't easily test the icon itself)
    expect(screen.getByTestId('visibility-selector')).toBeInTheDocument();
  });

  it('should show correct icon and label for public visibility', () => {
    const mockUseChatVisibility =
      require('@/hooks/use-chat-visibility').useChatVisibility;
    mockUseChatVisibility.mockReturnValue({
      visibilityType: 'public',
      setVisibilityType: jest.fn(),
    });

    render(
      <VisibilitySelector {...defaultProps} selectedVisibilityType="public" />,
    );

    expect(screen.getByText('Public')).toBeInTheDocument();
  });

  it('should render dropdown button', () => {
    render(<VisibilitySelector {...defaultProps} />);

    const button = screen.getByTestId('visibility-selector');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'button');
  });

  it('should handle dropdown interactions', () => {
    render(<VisibilitySelector {...defaultProps} />);

    const button = screen.getByTestId('visibility-selector');
    expect(button).toBeInTheDocument();

    // Button should have the correct ARIA attributes
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('should display correct initial visibility', () => {
    // The mock returns 'private' by default, so the button should show 'Private'
    const mockUseChatVisibility =
      require('@/hooks/use-chat-visibility').useChatVisibility;
    mockUseChatVisibility.mockReturnValue({
      visibilityType: 'private',
      setVisibilityType: jest.fn(),
    });

    render(
      <VisibilitySelector {...defaultProps} selectedVisibilityType="private" />,
    );

    const button = screen.getByTestId('visibility-selector');
    expect(button).toHaveTextContent('Private');
  });

  it('should use useChatVisibility hook correctly', () => {
    const mockUseChatVisibility =
      require('@/hooks/use-chat-visibility').useChatVisibility;

    render(<VisibilitySelector {...defaultProps} />);

    expect(mockUseChatVisibility).toHaveBeenCalledWith({
      chatId: 'test-chat-id',
      initialVisibilityType: 'private',
    });
  });

  it('should apply correct CSS classes', () => {
    render(<VisibilitySelector {...defaultProps} />);

    const button = screen.getByTestId('visibility-selector');
    expect(button).toHaveClass('hidden', 'md:flex', 'md:px-2', 'md:h-[34px]');
  });

  it('should handle custom className prop', () => {
    render(<VisibilitySelector {...defaultProps} className="custom-class" />);

    // The className is applied to the DropdownMenuTrigger wrapper
    const button = screen.getByTestId('visibility-selector');
    expect(button.closest('[class*="custom-class"]')).toBeTruthy();
  });

  it('should handle different visibility types', () => {
    const mockUseChatVisibility =
      require('@/hooks/use-chat-visibility').useChatVisibility;
    mockUseChatVisibility.mockReturnValue({
      visibilityType: 'public',
      setVisibilityType: jest.fn(),
    });

    render(
      <VisibilitySelector {...defaultProps} selectedVisibilityType="public" />,
    );

    const button = screen.getByTestId('visibility-selector');
    expect(button).toHaveTextContent('Public');
  });
});
