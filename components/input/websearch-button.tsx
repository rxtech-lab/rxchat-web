import { SearchIcon } from 'lucide-react';
import { memo } from 'react';
import { Button } from '../ui/button';

// WebSearchButton component to toggle web search functionality
function PureWebSearchButton({
  isWebSearchEnabled,
  onToggle,
  status,
}: {
  isWebSearchEnabled: boolean;
  onToggle: () => void;
  status: 'ready' | 'streaming' | 'submitted' | 'error';
}) {
  return (
    <Button
      variant="ghost"
      className={`rounded-md p-2 h-fit flex items-center gap-1.5 dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200 ${
        isWebSearchEnabled
          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
          : ''
      }`}
      data-testid="websearch-button"
      onClick={onToggle}
      disabled={status === 'streaming' || status === 'submitted'}
      title={
        isWebSearchEnabled
          ? 'Disable web search for this message'
          : 'Enable web search for this message'
      }
    >
      <SearchIcon size={14} />
      <span className="text-xs font-medium">
        {isWebSearchEnabled ? 'Web Search On' : 'Web Search'}
      </span>
    </Button>
  );
}

export const WebSearchButton = memo(PureWebSearchButton);
