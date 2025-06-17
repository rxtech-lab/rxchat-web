'use client';

import { testPrompt } from '@/app/(chat)/actions';
import type { Prompt } from '@/lib/db/schema';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { z } from 'zod';
import type { PromptSchema } from './input/prompt.schema';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { MonacoEditor } from './ui/monaco-editor';
import { Switch } from './ui/switch';

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
  const [isPublic, setIsPublic] = useState(prompt?.visibility === 'public');
  const [tags, setTags] = useState(prompt?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [icon, setIcon] = useState(prompt?.icon || '');

  const handleSubmit = useCallback(
    (skipValidation = false) => {
      if (!codeValid && !skipValidation) {
        return;
      }

      onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        code: code.trim(),
        visibility: isPublic ? 'public' : 'private',
        tags,
        icon,
      });
    },
    [code, codeValid, description, onSubmit, title, isPublic, tags, icon],
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
    <form className="space-y-6 flex flex-col h-full overflow-y-auto">
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

      <div className="space-y-2 flex items-center gap-2">
        <Label htmlFor="isPublic">Is Public</Label>
        <Switch
          id="isPublic"
          checked={isPublic}
          onCheckedChange={setIsPublic}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
        {/* biome-ignore lint/nursery/noStaticElementInteractions: <explanation> */}
        <div
          className="flex min-h-10 w-full flex-wrap gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          onClick={() => document.getElementById('tags')?.focus()}
        >
          {/* Display existing tags as badges inside the input */}
          {tags.map((tag, index) => (
            <Badge
              key={`${tag}-${
                // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                index
              }`}
              variant="secondary"
              className="flex items-center gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground h-6 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                const newTags = tags.filter((t) => t !== tag);
                setTags(newTags);
                handleSubmit(false);
              }}
            >
              {tag}
              <span className="ml-1 text-xs">×</span>
            </Badge>
          ))}

          {/* Input for adding new tags */}
          <input
            id="tags"
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder={
              tags.length === 0 ? 'Add tags (press Enter to add)' : ''
            }
            disabled={isLoading}
            className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const trimmedTag = newTag.trim();
                if (trimmedTag && !tags.includes(trimmedTag)) {
                  const newTags = [...tags, trimmedTag];
                  setTags(newTags);
                  setNewTag('');
                  handleSubmit(false);
                }
              } else if (
                e.key === 'Backspace' &&
                newTag === '' &&
                tags.length > 0
              ) {
                // Remove last tag when backspace is pressed on empty input
                const newTags = tags.slice(0, -1);
                setTags(newTags);
                handleSubmit(false);
              }
            }}
            onBlur={() => {
              const trimmedTag = newTag.trim();
              if (trimmedTag && !tags.includes(trimmedTag)) {
                const newTags = [...tags, trimmedTag];
                setTags(newTags);
                setNewTag('');
                handleSubmit(false);
              }
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="icon">Icon</Label>
        <Input
          id="icon"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="Optional icon"
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
            height="400px"
            placeholder="Enter your TypeScript code here..."
          />
        </div>
      </div>
    </form>
  );
}
