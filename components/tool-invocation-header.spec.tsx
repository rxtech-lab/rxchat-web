/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToolInvocationHeader } from './tool-invocation-header';

describe('ToolInvocationHeader', () => {
  const mockAppend = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    toolName: 'web_search',
    toolInvocation: {
      args: {
        query: 'test query'
      },
      state: 'result'
    },
    status: 'ready' as const,
    append: mockAppend
  };

  it('should render tool name badge', () => {
    render(<ToolInvocationHeader {...defaultProps} />);
    
    expect(screen.getByText('web_search')).toBeInTheDocument();
    const badge = screen.getByText('web_search').closest('div');
    expect(badge).toHaveClass('bg-blue-50', 'text-blue-700', 'rounded-md');
  });

  it('should display query parameter when provided', () => {
    render(<ToolInvocationHeader {...defaultProps} />);
    
    expect(screen.getByText('test query')).toBeInTheDocument();
    expect(screen.getByText('→')).toBeInTheDocument();
  });

  it('should display identifier parameter when provided', () => {
    const propsWithIdentifier = {
      ...defaultProps,
      toolInvocation: {
        args: {
          identifier: 'test-id'
        },
        state: 'result'
      }
    };
    
    render(<ToolInvocationHeader {...propsWithIdentifier} />);
    
    expect(screen.getByText('test-id')).toBeInTheDocument();
  });

  it('should show check icon for completed state', () => {
    render(<ToolInvocationHeader {...defaultProps} />);
    
    const checkIcon = document.querySelector('.lucide-check');
    expect(checkIcon).toBeInTheDocument();
    expect(checkIcon).toHaveClass('text-green-600');
  });

  it('should show alert icon for failed state', () => {
    const failedProps = {
      ...defaultProps,
      toolInvocation: {
        ...defaultProps.toolInvocation,
        state: 'failed'
      }
    };
    
    render(<ToolInvocationHeader {...failedProps} />);
    
    const alertIcon = document.querySelector('.lucide-circle-alert');
    expect(alertIcon).toBeInTheDocument();
    expect(alertIcon).toHaveClass('text-red-600');
  });

  it('should show spinner for call state with streaming status', () => {
    const streamingProps = {
      ...defaultProps,
      toolInvocation: {
        ...defaultProps.toolInvocation,
        state: 'call'
      },
      status: 'streaming' as const
    };
    
    render(<ToolInvocationHeader {...streamingProps} />);
    
    // Look for spinner by its class or component structure
    const spinnerElement = document.querySelector('.text-green-400');
    expect(spinnerElement).toBeInTheDocument();
  });

  it('should show alert icon for call state with non-streaming status', () => {
    const callProps = {
      ...defaultProps,
      toolInvocation: {
        ...defaultProps.toolInvocation,
        state: 'call'
      },
      status: 'ready' as const
    };
    
    render(<ToolInvocationHeader {...callProps} />);
    
    const alertIcon = document.querySelector('.lucide-circle-alert');
    expect(alertIcon).toBeInTheDocument();
    expect(alertIcon).toHaveClass('text-red-600');
  });

  it('should render iframe when iframeUrl is provided', () => {
    const propsWithIframe = {
      ...defaultProps,
      iframeUrl: 'https://example.com',
      suggestionHeight: 600
    };
    
    render(<ToolInvocationHeader {...propsWithIframe} />);
    
    const iframe = screen.getByTitle('MCP Result');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://example.com');
    expect(iframe).toHaveStyle({ minHeight: '600px' });
  });

  it('should render suggestions when provided', () => {
    const propsWithSuggestions = {
      ...defaultProps,
      suggestions: [
        { type: 'SUGGESTION_TYPE_CHAT' as const, text: 'Ask about React', value: 'Tell me about React' },
        { type: 'SUGGESTION_TYPE_CHAT' as const, text: 'Ask about Vue', value: 'Tell me about Vue' }
      ]
    };
    
    render(<ToolInvocationHeader {...propsWithSuggestions} />);
    
    expect(screen.getByText('Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Ask about React')).toBeInTheDocument();
    expect(screen.getByText('Ask about Vue')).toBeInTheDocument();
  });

  it('should handle suggestion click for chat type', () => {
    const propsWithSuggestions = {
      ...defaultProps,
      suggestions: [
        { type: 'SUGGESTION_TYPE_CHAT' as const, text: 'Ask about React', value: 'Tell me about React' }
      ]
    };
    
    render(<ToolInvocationHeader {...propsWithSuggestions} />);
    
    const suggestionButton = screen.getByText('Ask about React');
    fireEvent.click(suggestionButton);
    
    expect(mockAppend).toHaveBeenCalledWith({
      role: 'user',
      content: 'Tell me about React'
    });
  });

  it('should not render suggestions section when suggestions array is empty', () => {
    const propsWithEmptySuggestions = {
      ...defaultProps,
      suggestions: []
    };
    
    render(<ToolInvocationHeader {...propsWithEmptySuggestions} />);
    
    expect(screen.queryByText('Suggestions')).not.toBeInTheDocument();
  });

  it('should not render iframe when iframeUrl is not provided', () => {
    render(<ToolInvocationHeader {...defaultProps} />);
    
    expect(screen.queryByTitle('MCP Result')).not.toBeInTheDocument();
  });

  it('should truncate long parameter values', () => {
    const longQueryProps = {
      ...defaultProps,
      toolInvocation: {
        args: {
          query: 'This is a very long query that should be truncated in the UI'
        },
        state: 'result'
      }
    };
    
    render(<ToolInvocationHeader {...longQueryProps} />);
    
    const paramElement = screen.getByText('This is a very long query that should be truncated in the UI');
    expect(paramElement).toHaveClass('truncate', 'overflow-hidden', 'max-w-xs');
  });

  it('should use default suggestionHeight when not provided', () => {
    const propsWithIframe = {
      ...defaultProps,
      iframeUrl: 'https://example.com'
    };
    
    render(<ToolInvocationHeader {...propsWithIframe} />);
    
    const iframe = screen.getByTitle('MCP Result');
    expect(iframe).toHaveStyle({ minHeight: '500px' });
  });
});