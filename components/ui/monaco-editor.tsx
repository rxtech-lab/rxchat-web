'use client';

import { Editor } from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { memo, useRef } from 'react';
import prettier from 'prettier/standalone';
import typescriptParser from 'prettier/plugins/typescript';
import babelParser from 'prettier/plugins/babel';
import estreeParser from 'prettier/plugins/estree';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language?: string;
  height?: string;
  placeholder?: string;
  readOnly?: boolean;
}

/**
 * Monaco Editor component for code editing with dark mode support, axios LSP support, and cmd+s formatting
 * @param value - The current value of the editor
 * @param onChange - Callback when the editor content changes
 * @param language - Programming language for syntax highlighting (default: typescript)
 * @param height - Height of the editor (default: 400px)
 * @param placeholder - Placeholder text when editor is empty
 * @param readOnly - Whether the editor is read-only
 */
function MonacoEditorComponent({
  value,
  onChange,
  language = 'typescript',
  height = '400px',
  placeholder = 'Enter your code here...',
  readOnly = false,
}: MonacoEditorProps) {
  const { theme, resolvedTheme } = useTheme();
  const editorRef = useRef<any>(null);

  // Determine the Monaco theme based on the current theme
  // resolvedTheme handles 'system' theme by returning the actual resolved theme
  const monacoTheme = (resolvedTheme || theme) === 'dark' ? 'vs-dark' : 'light';

  /**
   * Inject axios and other common library types into Monaco's TypeScript environment
   */
  const injectGlobalTypes = (monaco: any) => {
    // Only inject types for TypeScript language
    if (language !== 'typescript') {
      return;
    }

    // Add global fetch and common utility types
    const libSource = `
  // Add this export to make it a module
export {};

declare global {
  interface AxiosRequestConfig {
    url?: string;
    method?:
      | "get"
      | "GET"
      | "delete"
      | "DELETE"
      | "head"
      | "HEAD"
      | "options"
      | "OPTIONS"
      | "post"
      | "POST"
      | "put"
      | "PUT"
      | "patch"
      | "PATCH";
    baseURL?: string;
    headers?: any;
    params?: any;
    data?: any;
    timeout?: number;
    withCredentials?: boolean;
    responseType?:
      | "arraybuffer"
      | "blob"
      | "document"
      | "json"
      | "text"
      | "stream";
  }

  interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: AxiosRequestConfig;
  }

  interface AxiosError<T = any> extends Error {
    config: AxiosRequestConfig;
    code?: string;
    response?: AxiosResponse<T>;
    isAxiosError: boolean;
  }

  interface AxiosInstance {
    (config: AxiosRequestConfig): Promise<AxiosResponse>;
    (url: string, config?: AxiosRequestConfig): Promise<AxiosResponse>;
  }

  interface AxiosStatic extends AxiosInstance {
    create(config?: AxiosRequestConfig): AxiosInstance;
    isAxiosError(payload: any): payload is AxiosError;
  }

  // Global axios object - no import needed
  const axios: AxiosStatic;
}
`;
    const libUrl = 'file:///globals.d.ts';

    try {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        libSource,
        libUrl,
      );
      monaco.languages.typescript.javascriptDefaults.addExtraLib(
        libSource,
        libUrl,
      );
    } catch (error) {
      console.warn('Failed to inject global types:', error);
    }
  };

  /**
   * Format the current code using Prettier
   */
  const formatCode = async () => {
    if (editorRef.current) {
      try {
        const model = editorRef.current.getModel();
        if (!model) return;

        const currentValue = model.getValue();
        if (!currentValue.trim()) return;

        // Determine the parser based on language
        let parser = 'typescript';
        let plugins = [typescriptParser, estreeParser];

        if (language === 'javascript') {
          parser = 'babel';
          plugins = [babelParser, estreeParser];
        } else if (language === 'json') {
          parser = 'json';
          plugins = [babelParser];
        }

        // Format with Prettier
        const formatted = await prettier.format(currentValue, {
          parser,
          plugins,
          semi: true,
          trailingComma: 'all',
          singleQuote: true,
          printWidth: 80,
          tabWidth: 2,
          useTabs: false,
          bracketSpacing: true,
          arrowParens: 'avoid',
        });

        // Update the editor content
        const selection = editorRef.current.getSelection();
        model.setValue(formatted);

        // Restore selection if it existed
        if (selection) {
          editorRef.current.setSelection(selection);
        }

        // Trigger onChange callback
        onChange(formatted);
      } catch (error) {
        console.warn('Prettier formatting failed:', error);
        // Fallback to Monaco's built-in formatter
        try {
          await editorRef.current
            .getAction('editor.action.formatDocument')
            ?.run();
        } catch (fallbackError) {
          console.warn('Fallback formatting also failed:', fallbackError);
        }
      }
    }
  };

  /**
   * Handle editor mount event
   */
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Set proper URI for TypeScript files to enable language services
    if (language === 'typescript') {
      const model = editor.getModel();
      if (model) {
        // Dispose the current model and create a new one with proper URI
        const currentValue = model.getValue();
        model.dispose();

        // Create a new model with TypeScript URI
        const newModel = monaco.editor.createModel(
          currentValue,
          'typescript',
          monaco.Uri.parse('file:///a.ts'),
        );

        editor.setModel(newModel);
      }
    }

    // Inject global types for better LSP support
    injectGlobalTypes(monaco);

    // Prevent default browser save behavior
    editor.onKeyDown((e: any) => {
      if ((e.ctrlKey || e.metaKey) && e.keyCode === monaco.KeyCode.KeyS) {
        e.preventDefault();
        e.stopPropagation();
        formatCode();
      }
    });

    // Focus the editor
    editor.focus();
  };

  return (
    <div>
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={onChange}
        theme={monacoTheme}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          automaticLayout: true,
          readOnly,
          placeholder,
          suggest: {
            showKeywords: true,
            showSnippets: true,
            showMethods: true,
            showFunctions: true,
            showConstructors: true,
            showFields: true,
            showVariables: true,
            showClasses: true,
            showStructs: true,
            showInterfaces: true,
            showModules: true,
            showProperties: true,
            showEvents: true,
            showOperators: true,
            showUnits: true,
            showValues: true,
            showConstants: true,
            showEnums: true,
            showEnumMembers: true,
            showTypeParameters: true,
          },
          quickSuggestions: {
            other: true,
            comments: true,
            strings: true,
          },
          // Enhanced IntelliSense settings
          acceptSuggestionOnCommitCharacter: true,
          acceptSuggestionOnEnter: 'on',
          autoIndent: 'full',
          codeLens: true,
          colorDecorators: true,
          contextmenu: true,
          cursorBlinking: 'blink',
          cursorSmoothCaretAnimation: 'on',
          cursorStyle: 'line',
          dragAndDrop: true,
          folding: true,
          foldingStrategy: 'auto',
          fontLigatures: false,
          formatOnPaste: true,
          formatOnType: true,
          links: true,
          mouseWheelZoom: false,
          multiCursorMergeOverlapping: true,
          multiCursorModifier: 'alt',
          overviewRulerBorder: true,
          overviewRulerLanes: 2,
          quickSuggestionsDelay: 500,
          renderControlCharacters: false,
          renderFinalNewline: 'on',
          renderLineHighlight: 'line',
          renderWhitespace: 'selection',
          revealHorizontalRightPadding: 30,
          roundedSelection: true,
          rulers: [],
          showFoldingControls: 'mouseover',
          smoothScrolling: false,
          suggestOnTriggerCharacters: true,
          wordBasedSuggestions: 'currentDocument',
          wordSeparators: '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?',
          wordWrapBreakAfterCharacters: '\t})]?|&,;',
          wordWrapBreakBeforeCharacters: '{([+',
          wordWrapColumn: 80,
          wrappingIndent: 'none',
          // Additional dark mode friendly options
          bracketPairColorization: {
            enabled: true,
          },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
        }}
        loading={
          <div className="p-4 text-center text-muted-foreground bg-background">
            Loading editor...
          </div>
        }
      />
    </div>
  );
}

export const MonacoEditor = memo(MonacoEditorComponent);
