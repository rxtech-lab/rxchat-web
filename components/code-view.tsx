import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeViewProps {
  code: string;
  language: string;
  maxHeight?: number;
  readonly?: boolean;
}

/**
 * CodeView component that displays code using React Syntax Highlighter
 * @param code - The code content to display
 * @param language - The programming language for syntax highlighting
 * @param maxHeight - Optional maximum height in pixels for the editor
 * @param readonly - Optional flag to make the editor read-only (note: syntax highlighter is always read-only)
 */
export function CodeView({
  code,
  language,
  maxHeight = 400,
  readonly = true,
}: CodeViewProps) {
  return (
    <div
      className="w-full overflow-auto bg-muted rounded-md"
      style={{ maxHeight: `${maxHeight}px` }}
    >
      <div className="max-w-[660px]">
        <SyntaxHighlighter
          language={language}
          style={vs}
          showLineNumbers={true}
          wrapLines={true}
          wrapLongLines={true}
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '14px',
            backgroundColor: 'transparent',
            border: 0,
          }}
          codeTagProps={{
            style: {
              fontSize: '14px',
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
