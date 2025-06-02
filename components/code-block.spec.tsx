/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CodeBlock } from './code-block';

describe('CodeBlock', () => {
  it('should render inline code with semantic styling', () => {
    render(
      <CodeBlock
        node={null}
        inline={true}
        className="language-js"
      >
        console.log('hello')
      </CodeBlock>
    );

    const codeElement = screen.getByText("console.log('hello')");
    expect(codeElement).toBeInTheDocument();
    expect(codeElement.tagName).toBe('CODE');
    expect(codeElement).toHaveClass('text-sm', 'bg-muted/50', 'text-muted-foreground', 'py-0.5', 'px-1', 'rounded-md');
  });

  it('should render block code with semantic styling', () => {
    render(
      <CodeBlock
        node={null}
        inline={false}
        className="language-js"
      >
        console.log('hello world')
      </CodeBlock>
    );

    const codeElement = screen.getByText("console.log('hello world')");
    expect(codeElement).toBeInTheDocument();
    expect(codeElement.tagName).toBe('CODE');
    
    // Check the pre element styling uses semantic colors
    const preElement = codeElement.parentElement;
    expect(preElement?.tagName).toBe('PRE');
    expect(preElement).toHaveClass(
      'text-sm',
      'w-full',
      'overflow-x-auto',
      'bg-muted',
      'text-muted-foreground',
      'p-4',
      'border',
      'border-border',
      'rounded-xl'
    );
  });

  it('should work well in different theme contexts', () => {
    // Test that semantic colors are used instead of hardcoded zinc colors
    const { container } = render(
      <CodeBlock
        node={null}
        inline={false}
        className="language-js"
      >
        const test = 'semantic colors';
      </CodeBlock>
    );

    const preElement = container.querySelector('pre');
    expect(preElement).not.toHaveClass('dark:bg-zinc-900', 'text-zinc-900', 'dark:text-zinc-50');
    expect(preElement).toHaveClass('bg-muted', 'text-muted-foreground');
  });
});