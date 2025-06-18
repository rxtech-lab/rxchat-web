import type { UseChatHelpers } from '@ai-sdk/react';
import { CheckIcon, CircleAlertIcon } from 'lucide-react';
import type { z } from 'zod';
import type { SuggestionListSchema } from './message.utils';
import Spinner from './spiner';
import { Button } from './ui/button';

interface ToolInvocationHeaderProps {
  toolName: string;
  toolInvocation: {
    args?: {
      identifier?: string;
      query?: string;
    };
    state: string;
  };
  status: UseChatHelpers['status'];
  iframeUrl?: string;
  suggestions?: z.infer<typeof SuggestionListSchema>[];
  suggestionHeight?: number;
  append: UseChatHelpers['append'];
}

/**
 * Component that displays the header information for a tool invocation,
 * including the tool name badge, parameters, and status indicator.
 */
export function ToolInvocationHeader({
  toolName,
  toolInvocation,
  status,
  iframeUrl,
  suggestions,
  suggestionHeight,
  append,
}: ToolInvocationHeaderProps) {
  const { args, state } = toolInvocation;

  const renderStatusIcon = () => {
    if (toolInvocation.state === 'failed') {
      return <CircleAlertIcon size={16} className="text-red-600" />;
    }

    if (state === 'call') {
      return status === 'streaming' ? (
        <Spinner
          className="text-green-400 color-green-400"
          size="sm"
          color="black"
        />
      ) : (
        <CircleAlertIcon size={16} className="text-red-600" />
      );
    }
    return <CheckIcon size={16} className="text-green-600" />;
  };

  const handleSuggestionClick = (
    suggestion: z.infer<typeof SuggestionListSchema>,
  ) => {
    if (suggestion.type === 'SUGGESTION_TYPE_CHAT') {
      append({
        role: 'user',
        content: suggestion.value,
      });
    }
  };

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center gap-3 w-full">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-200">
            <div className="size-1.5 bg-blue-500 rounded-full" />
            {toolName}
          </div>
          {(args?.identifier || args?.query) && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-muted-foreground text-xs">→</span>
              <span
                className="text-xs text-foreground/80 font-mono bg-muted/50 px-2 py-0.5 rounded max-w-xs truncate overflow-hidden"
                title={args?.identifier || args?.query}
              >
                {args?.identifier || args?.query}
              </span>
            </div>
          )}
        </div>
        <span className="text-xs px-2 py-1 rounded">{renderStatusIcon()}</span>
      </div>
      {iframeUrl && (
        <div className="mt-4">
          <iframe
            title="MCP Result"
            src={iframeUrl}
            className="w-full rounded-lg border p-1"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
            style={{
              minHeight: suggestionHeight ?? 500,
            }}
          />
        </div>
      )}

      {suggestions && (
        <div className="mt-4">
          <div className="text-sm font-medium">Suggestions</div>
          <div className="text-sm text-muted-foreground flex flex-row gap-2 flex-wrap">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion.value}
                variant="default"
                className="rounded-2xl !h-8 !text-xs"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion.text}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
