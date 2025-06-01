'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { $createParagraphNode, $getRoot, } from 'lexical';
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { ListItemNode, ListNode } from '@lexical/list';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { KEY_DOWN_COMMAND, COMMAND_PRIORITY_LOW, type EditorState } from 'lexical';
import { cn } from '@/lib/utils';

const theme = {
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-muted px-1 py-0.5 rounded text-sm font-mono',
  },
  heading: {
    h1: 'text-3xl font-semibold mt-6 mb-2',
    h2: 'text-2xl font-semibold mt-6 mb-2',
    h3: 'text-xl font-semibold mt-6 mb-2',
    h4: 'text-lg font-semibold mt-6 mb-2',
    h5: 'text-base font-semibold mt-6 mb-2',
    h6: 'text-sm font-semibold mt-6 mb-2',
  },
  quote: 'border-l-4 border-gray-300 pl-4 italic text-gray-600 dark:text-gray-400',
  code: 'bg-muted p-2 rounded font-mono text-sm overflow-x-auto',
  codeHighlight: {
    atrule: 'text-purple-600',
    attr: 'text-blue-600',
    boolean: 'text-orange-600',
    builtin: 'text-purple-600',
    cdata: 'text-gray-400',
    char: 'text-green-600',
    class: 'text-blue-600',
    'class-name': 'text-blue-600',
    comment: 'text-gray-400',
    constant: 'text-orange-600',
    deleted: 'text-red-600',
    doctype: 'text-gray-400',
    entity: 'text-orange-600',
    function: 'text-purple-600',
    important: 'text-red-600',
    inserted: 'text-green-600',
    keyword: 'text-purple-600',
    namespace: 'text-blue-600',
    number: 'text-orange-600',
    operator: 'text-gray-600',
    prolog: 'text-gray-400',
    property: 'text-blue-600',
    punctuation: 'text-gray-600',
    regex: 'text-green-600',
    selector: 'text-blue-600',
    string: 'text-green-600',
    symbol: 'text-orange-600',
    tag: 'text-red-600',
    url: 'text-blue-600',
    variable: 'text-orange-600',
  },
  list: {
    nested: {
      listitem: 'list-none',
    },
    ol: 'list-decimal list-outside ml-4',
    ul: 'list-disc list-outside ml-4',
    listitem: 'py-1',
  },
  link: 'text-blue-500 hover:underline',
  paragraph: 'mb-2',
};

// Plugin to set initial content from markdown
function InitialContentPlugin({ 
  initialValue, 
  isReadonly 
}: { 
  initialValue: string;
  isReadonly: boolean;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.update(() => {
      if (initialValue) {
        $convertFromMarkdownString(initialValue, TRANSFORMERS);
      } else {
        const root = $getRoot();
        const paragraph = $createParagraphNode();
        root.append(paragraph);
      }
    });
  }, [editor, initialValue]);

  useEffect(() => {
    editor.setEditable(!isReadonly);
  }, [editor, isReadonly]);

  return null;
}

// Plugin to handle keyboard events
function KeyboardEventPlugin({ onKeyDown }: { onKeyDown?: (event: KeyboardEvent) => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!onKeyDown) return;

    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        onKeyDown(event);
        return false; // Allow other handlers to run
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, onKeyDown]);

  return null;
}

interface MarkdownViewProps {
  /** The markdown content to display or initial value for editing */
  value?: string;
  /** Whether the component is read-only or editable */
  readOnly?: boolean;
  /** Callback when content changes (only for editable mode) */
  onChange?: (markdown: string) => void;
  /** Placeholder text for editable mode */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  'data-testid'?: string;
  /** Key down handler for editable mode */
  onKeyDown?: (event: KeyboardEvent) => void;
}

/**
 * MarkdownView component that can render markdown content in read-only mode
 * or provide an editable interface using Lexical editor.
 * Supports switching between read-only and editable modes.
 */
export function MarkdownView({
  value = '',
  readOnly = false,
  onChange,
  placeholder = 'Enter text...',
  className,
  'data-testid': testId,
  onKeyDown,
}: MarkdownViewProps) {
  const contentEditableRef = useRef<HTMLDivElement>(null);

  const initialConfig = {
    namespace: 'MarkdownView',
    theme,
    onError: (error: Error) => {
      console.error('Lexical error:', error);
    },
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
    ],
  };

  const handleEditorChange = useCallback(
    (editorState: EditorState) => {
      if (readOnly || !onChange) return;

      editorState.read(() => {
        const markdown = $convertToMarkdownString(TRANSFORMERS);
        onChange(markdown);
      });
    },
    [onChange, readOnly]
  );

  const handleFocus = useCallback(() => {
    if (contentEditableRef.current) {
      contentEditableRef.current.focus();
    }
  }, []);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div 
        className={cn(
          'relative w-full',
          readOnly ? 'cursor-default' : 'cursor-text',
          className
        )}
        data-testid={testId}
        onClick={readOnly ? undefined : handleFocus}
      >
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              ref={contentEditableRef}
              className={cn(
                'outline-none',
                readOnly 
                  ? 'cursor-default' 
                  : 'min-h-[24px] cursor-text focus:outline-none'
              )}
            />
          }
          placeholder={
            readOnly ? null : (
              <div className="absolute top-0 left-0 text-muted-foreground pointer-events-none select-none">
                {placeholder}
              </div>
            )
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        
        {/* Plugins */}
        <InitialContentPlugin initialValue={value} isReadonly={readOnly} />
        {!readOnly && <HistoryPlugin />}
        {!readOnly && <OnChangePlugin onChange={handleEditorChange} />}
        {!readOnly && <KeyboardEventPlugin onKeyDown={onKeyDown} />}
        <ListPlugin />
      </div>
    </LexicalComposer>
  );
}