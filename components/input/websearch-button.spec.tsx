/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WebSearchButton } from './websearch-button';

describe('WebSearchButton', () => {
  const defaultProps = {
    isWebSearchEnabled: false,
    onToggle: jest.fn(),
    status: 'ready' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with default state', () => {
    render(<WebSearchButton {...defaultProps} />);

    const button = screen.getByTestId('websearch-button');
    expect(button).toBeInTheDocument();
    expect(screen.getByText('Web Search')).toBeInTheDocument();
  });

  it('should show enabled state when web search is active', () => {
    render(<WebSearchButton {...defaultProps} isWebSearchEnabled={true} />);

    const button = screen.getByTestId('websearch-button');
    expect(button).toHaveClass('bg-blue-100');
    expect(screen.getByText('Web Search')).toBeInTheDocument();
  });

  it('should call onToggle when clicked', () => {
    const onToggle = jest.fn();
    render(<WebSearchButton {...defaultProps} onToggle={onToggle} />);

    const button = screen.getByTestId('websearch-button');
    fireEvent.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when status is streaming', () => {
    render(<WebSearchButton {...defaultProps} status="streaming" />);

    const button = screen.getByTestId('websearch-button');
    expect(button).toBeDisabled();
  });

  it('should be disabled when status is submitted', () => {
    render(<WebSearchButton {...defaultProps} status="submitted" />);

    const button = screen.getByTestId('websearch-button');
    expect(button).toBeDisabled();
  });

  it('should be enabled when status is ready', () => {
    render(<WebSearchButton {...defaultProps} status="ready" />);

    const button = screen.getByTestId('websearch-button');
    expect(button).not.toBeDisabled();
  });

  it('should be enabled when status is error', () => {
    render(<WebSearchButton {...defaultProps} status="error" />);

    const button = screen.getByTestId('websearch-button');
    expect(button).not.toBeDisabled();
  });

  it('should have proper tooltips', () => {
    const { rerender } = render(<WebSearchButton {...defaultProps} />);

    expect(screen.getByTestId('websearch-button')).toHaveAttribute(
      'title',
      'Enable web search for this message',
    );

    rerender(<WebSearchButton {...defaultProps} isWebSearchEnabled={true} />);

    expect(screen.getByTestId('websearch-button')).toHaveAttribute(
      'title',
      'Disable web search for this message',
    );
  });
});
