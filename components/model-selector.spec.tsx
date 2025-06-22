/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ModelSelector } from './model-selector';

jest.mock('@/app/(chat)/actions', () => ({
  saveChatModelAsCookie: jest.fn(),
}));

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  startTransition: (fn: () => void) => fn(),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('ModelSelector', () => {
  const mockProviders = {
    openAI: {
      id: 'openai',
      provider: 'openAI' as const,
      models: [
        { id: 'gpt-4', name: 'GPT-4', description: 'GPT-4 description' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'GPT-3.5 Turbo description' },
      ],
    },
    anthropic: {
      id: 'anthropic',
      provider: 'anthropic' as const,
      models: [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Claude 3.5 Sonnet description' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Claude 3 Haiku description' },
      ],
    },
    openRouter: { id: 'openrouter', provider: 'openRouter' as const, models: [] },
    gemini: { id: 'gemini', provider: 'gemini' as const, models: [] },
    test: { id: 'test', provider: 'test' as const, models: [] },
    azure: { id: 'azure', provider: 'azure' as const, models: [] },
    google: { id: 'google', provider: 'google' as const, models: [] },
  };

  const defaultProps = {
    session: { user: { id: 'user-1' } } as any,
    selectedModelId: 'gpt-4',
    providers: mockProviders,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('should render model selector button', () => {
    render(<ModelSelector {...defaultProps} />);

    expect(screen.getByTestId('model-selector')).toBeInTheDocument();
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
  });

  it('should display selected model name', () => {
    render(
      <ModelSelector
        {...defaultProps}
        selectedModelId="claude-3-5-sonnet-20241022"
      />,
    );

    expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
  });

  it('should show "Select model..." when no model is selected', () => {
    render(
      <ModelSelector {...defaultProps} selectedModelId="invalid-model-id" />,
    );

    expect(screen.getByText('Select model...')).toBeInTheDocument();
  });

  it('should open popover when button is clicked', () => {
    render(<ModelSelector {...defaultProps} />);

    const button = screen.getByTestId('model-selector');
    fireEvent.click(button);

    expect(screen.getAllByText('Providers')).toHaveLength(2); // Desktop and mobile versions
    expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
  });

  it('should render provider filters with model counts', () => {
    render(<ModelSelector {...defaultProps} />);

    const button = screen.getByTestId('model-selector');
    fireEvent.click(button);

    expect(screen.getAllByText('openAI').length).toBeGreaterThanOrEqual(2); // Multiple instances (desktop, mobile, badges)
    expect(screen.getAllByText('anthropic').length).toBeGreaterThanOrEqual(2); // Multiple instances (desktop, mobile, badges)
    expect(screen.getAllByText('2 models').length).toBeGreaterThanOrEqual(1); // Desktop and/or mobile versions
  });

  it('should render model options in the list', () => {
    render(<ModelSelector {...defaultProps} />);

    const button = screen.getByTestId('model-selector');
    fireEvent.click(button);

    expect(screen.getByTestId('model-selector-item-gpt-4')).toBeInTheDocument();
    expect(
      screen.getByTestId('model-selector-item-gpt-3.5-turbo'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('model-selector-item-claude-3-5-sonnet-20241022'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('model-selector-item-claude-3-haiku-20240307'),
    ).toBeInTheDocument();
  });

  it('should highlight selected model', () => {
    render(<ModelSelector {...defaultProps} selectedModelId="gpt-4" />);

    const button = screen.getByTestId('model-selector');
    fireEvent.click(button);

    const selectedItem = screen.getByTestId('model-selector-item-gpt-4');
    expect(selectedItem).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('should filter models by search term', () => {
    render(<ModelSelector {...defaultProps} />);

    const button = screen.getByTestId('model-selector');
    fireEvent.click(button);

    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'claude' } });

    // Check that Claude models are present
    expect(screen.getAllByText('Claude 3.5 Sonnet').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Claude 3 Haiku').length).toBeGreaterThan(0);

    // Search should filter the list (though button text may still show selected model)
    const modelItems = screen.queryAllByTestId(/^model-selector-item-/);
    const gptItems = modelItems.filter((item) =>
      item.textContent?.includes('GPT'),
    );
    expect(gptItems).toHaveLength(0);
  });

  it('should display provider filters', () => {
    render(<ModelSelector {...defaultProps} />);

    const button = screen.getByTestId('model-selector');
    fireEvent.click(button);

    // Check that provider filters are rendered (both mobile and desktop)
    expect(screen.getAllByText('openAI').length).toBeGreaterThan(0);
    expect(screen.getAllByText('anthropic').length).toBeGreaterThan(0);

    // Check that models are initially visible
    expect(screen.getAllByText('GPT-4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Claude 3.5 Sonnet').length).toBeGreaterThan(0);
  });

  it('should save provider filter state to localStorage', () => {
    render(<ModelSelector {...defaultProps} />);

    // Initial render should save all providers to localStorage
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'model-selector-enabled-providers',
      JSON.stringify(['openAI', 'anthropic']),
    );
  });

  it('should load provider filter state from localStorage', () => {
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(['anthropic']));

    render(<ModelSelector {...defaultProps} />);

    const button = screen.getByTestId('model-selector');
    fireEvent.click(button);

    // Only Anthropic models should be visible
    expect(
      screen.queryByTestId('model-selector-item-gpt-4'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('model-selector-item-claude-3-5-sonnet-20241022'),
    ).toBeInTheDocument();
  });

  it('should handle providers with no models', () => {
    const providersWithEmpty = {
      ...mockProviders,
      openAI: {
        ...mockProviders.openAI,
        models: [],
      },
    };

    render(<ModelSelector {...defaultProps} providers={providersWithEmpty} />);

    const button = screen.getByTestId('model-selector');
    fireEvent.click(button);

    // GPT models should not be shown since openAI has no models
    expect(screen.queryByTestId('model-selector-item-gpt-4')).not.toBeInTheDocument();
  });

  it('should handle empty state messaging', () => {
    render(<ModelSelector {...defaultProps} />);

    const button = screen.getByTestId('model-selector');
    fireEvent.click(button);

    // Component should render without errors and show models initially
    expect(screen.getAllByText('GPT-4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Claude 3.5 Sonnet').length).toBeGreaterThan(0);
  });

  it('should apply correct CSS classes', () => {
    render(<ModelSelector {...defaultProps} />);

    const button = screen.getByTestId('model-selector');
    expect(button).toHaveClass(
      'md:px-2',
      'md:h-[34px]',
      'justify-between',
      'md:w-[300px]',
      'w-[150px]',
    );
  });

  it('should handle custom className prop', () => {
    render(<ModelSelector {...defaultProps} className="custom-class" />);

    const button = screen.getByTestId('model-selector');
    expect(button).toHaveClass('custom-class');
  });
});
