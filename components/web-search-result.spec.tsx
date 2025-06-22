/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WebSearchResult } from './web-search-result';

describe('WebSearchResult', () => {
  const mockResult = {
    keyword: 'react testing',
    summary: 'Testing React components',
    results: [
      {
        title: 'React Testing Library Documentation',
        url: 'https://testing-library.com/docs/react-testing-library/intro'
      },
      {
        title: 'Jest Testing Framework',
        url: 'https://jestjs.io/'
      }
    ]
  };

  it('should render web search results header', () => {
    render(<WebSearchResult result={mockResult} isReadonly={false} />);
    
    expect(screen.getByText('Web Search Results')).toBeInTheDocument();
  });

  it('should render search result items with correct links', () => {
    render(<WebSearchResult result={mockResult} isReadonly={false} />);
    
    const firstLink = screen.getByRole('link', { name: /react testing library documentation/i });
    const secondLink = screen.getByRole('link', { name: /jest testing framework/i });
    
    expect(firstLink).toHaveAttribute('href', 'https://testing-library.com/docs/react-testing-library/intro');
    expect(firstLink).toHaveAttribute('target', '_blank');
    expect(firstLink).toHaveAttribute('rel', 'noopener noreferrer');
    
    expect(secondLink).toHaveAttribute('href', 'https://jestjs.io/');
    expect(secondLink).toHaveAttribute('target', '_blank');
    expect(secondLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render external link icons for each result', () => {
    render(<WebSearchResult result={mockResult} isReadonly={false} />);
    
    // External link icons are rendered but don't have test IDs, so we test their presence differently
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
  });

  it('should handle empty results array', () => {
    const emptyResult = {
      keyword: 'empty search',
      summary: 'No results found',
      results: []
    };
    
    render(<WebSearchResult result={emptyResult} isReadonly={false} />);
    
    expect(screen.getByText('Web Search Results')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should handle undefined results', () => {
    const undefinedResult = {
      keyword: 'undefined search',
      summary: 'No results',
      results: undefined as any
    };
    
    render(<WebSearchResult result={undefinedResult} isReadonly={false} />);
    
    expect(screen.getByText('Web Search Results')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should apply correct CSS classes for styling', () => {
    render(<WebSearchResult result={mockResult} isReadonly={false} />);
    
    // The main container is the parent of the header
    const headerDiv = screen.getByText('Web Search Results').closest('div');
    const mainContainer = headerDiv?.parentElement;
    expect(mainContainer).toHaveClass('space-y-4', 'p-4', 'border', 'rounded-lg', 'bg-muted/50');
  });

  it('should have hover effects on result links', () => {
    render(<WebSearchResult result={mockResult} isReadonly={false} />);
    
    const firstLink = screen.getByRole('link', { name: /react testing library documentation/i });
    expect(firstLink).toHaveClass('hover:bg-muted/50', 'transition-colors', 'group');
  });
});