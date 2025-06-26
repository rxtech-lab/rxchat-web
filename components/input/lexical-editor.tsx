'use client';

import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import cx from 'classnames';
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import { useEffect } from 'react';

import { MentionNode } from './nodes/mention-node';
import { EnterSendPlugin } from './plugins/enter-send-plugin';
import MCPToolsMentionsPlugin from './plugins/mentions-plugin';

interface LexicalEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const theme = {
  paragraph: 'mb-1',
  text: {
    bold: 'font-semibold',
    italic: 'italic',
    underline: 'underline',
  },
  mention:
    'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-1 py-0.5 rounded text-sm font-medium cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors',
};

function ValueUpdatePlugin({
  value,
}: {
  value: string;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.update(() => {
      const root = $getRoot();
      const currentContent = root.getTextContent();

      if (currentContent !== value) {
        root.clear();
        if (value) {
          const paragraph = $createParagraphNode();
          root.append(paragraph);
          paragraph.append($createTextNode(value));
        }
      }
    });
  }, [editor, value]);

  return null;
}

export function LexicalEditor({
  value,
  onChange,
  onSubmit,
  placeholder = 'Send a message...',
  className,
  disabled = false,
}: LexicalEditorProps) {
  const initialConfig = {
    namespace: 'input-editor',
    theme,
    onError: (error: Error) => {
      console.error('Lexical error:', error);
    },
    nodes: [MentionNode],
  };

  return (
    <div className={cx('relative w-full', className)}>
      <LexicalComposer initialConfig={initialConfig as any}>
        <div className="relative">
          <PlainTextPlugin
            contentEditable={
              <ContentEditable
                data-testid="multimodal-input"
                className={cx(
                  'min-h-[24px] max-h-full overflow-y-auto resize-none !text-base bg-transparent p-4 outline-none',
                  'placeholder:text-muted-foreground',
                  disabled && 'opacity-50 cursor-not-allowed',
                )}
                ariaLabel="Message input"
              />
            }
            placeholder={
              <div className="absolute top-4 left-4 text-muted-foreground pointer-events-none">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />

          <OnChangePlugin
            onChange={(editorState) => {
              const textContent = editorState.read(() =>
                $getRoot().getTextContent(),
              );
              onChange(textContent);
            }}
          />
          <ValueUpdatePlugin value={value} />
          <HistoryPlugin />
          <AutoFocusPlugin />
          <EnterSendPlugin onSend={onSubmit} />
          <MCPToolsMentionsPlugin />
        </div>
      </LexicalComposer>
    </div>
  );
}
