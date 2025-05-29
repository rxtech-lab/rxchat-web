'use client';

import { testPrompt } from '@/app/(chat)/actions';
import type { Prompt } from '@/lib/db/schema';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { z } from 'zod';
import type { PromptSchema } from './input/prompt.schema';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { MonacoEditor } from './ui/monaco-editor';

interface PromptFormProps {
  prompt?: Prompt;
  onSubmit: (data: z.infer<typeof PromptSchema>) => Promise<void>;
  isLoading?: boolean;
}

const defaultCode = `async function prompt(): Promise<string> {
  return 'Hello, world!';
}
`;

/**
 * Form component for creating and editing prompts
 * @param prompt - Existing prompt data for editing (optional)
 * @param onSubmit - Callback when form is submitted
 * @param isLoading - Whether the form is in loading state
 */
export function PromptForm({
  prompt,
  onSubmit,
  isLoading = false,
}: PromptFormProps) {
  const [title, setTitle] = useState(prompt?.title || '');
  const [description, setDescription] = useState(prompt?.description || '');
  const [code, setCode] = useState(prompt?.code || defaultCode);
  const [codeValid, setCodeValid] = useState(false);
  const [isTestingCode, setIsTestingCode] = useState(false);

  const handleSubmit = useCallback(
    (skipValidation = false) => {
      if (!codeValid && !skipValidation) {
        return;
      }

      onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        code: code.trim(),
      });
    },
    [code, codeValid, description, onSubmit, title],
  );

  const handleTestCode = useCallback(
    async (code: string) => {
      setIsTestingCode(true);

      const testPromise = testPrompt(code.trim())
        .then((result) => {
          if ('error' in result) {
            setCodeValid(false);
            throw new Error(result.error);
          }
          handleSubmit(true);
          setCodeValid(true);
          return result;
        })
        .catch((error) => {
          setCodeValid(false);
          throw error;
        })
        .finally(() => {
          setIsTestingCode(false);
        });

      toast.promise(testPromise, {
        loading: 'Testing code...',
        success: (result) =>
          `Code executed successfully! \nResult: ${result.result}`,
        error: (error) =>
          `Code test failed: ${error.message || 'Unknown error'}`,
      });
    },
    [handleSubmit],
  );

  return (
    <form className="space-y-6 flex flex-col h-full">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter prompt title"
          required
          disabled={isLoading}
          onBlur={() => handleSubmit(false)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          disabled={isLoading}
          onBlur={() => handleSubmit(false)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="code">Code *</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleTestCode(code)}
            disabled={isLoading || isTestingCode || !code.trim()}
            className="ml-auto"
          >
            {isTestingCode ? 'Testing...' : 'Test Code'}
          </Button>
        </div>
        <div className=" border border-border rounded-2xl p-4">
          <MonacoEditor
            value={code}
            onChange={(value) => {
              setCode(value || '');
              setCodeValid(false);
            }}
            onSave={(code) => handleTestCode(code)}
            language="typescript"
            height="600px"
            placeholder="Enter your TypeScript code here..."
          />
        </div>
      </div>
    </form>
  );
}
