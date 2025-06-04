import { CheckIcon, CircleAlertIcon } from 'lucide-react';
import type { UseChatHelpers } from '@ai-sdk/react';
import Spinner from './spiner';

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
}

/**
 * Component that displays the header information for a tool invocation,
 * including the tool name badge, parameters, and status indicator.
 */
export function ToolInvocationHeader({
  toolName,
  toolInvocation,
  status,
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

  return (
    <>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-200">
          <div className="size-1.5 bg-blue-500 rounded-full" />
          {toolName}
        </div>
        {(args?.identifier || args?.query) && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground text-xs">→</span>
            <span className="text-xs text-foreground/80 truncate font-mono bg-muted/50 px-2 py-0.5 rounded">
              {args?.identifier || args?.query}
            </span>
          </div>
        )}
      </div>
      <span className="text-xs px-2 py-1 rounded">{renderStatusIcon()}</span>
    </>
  );
}
