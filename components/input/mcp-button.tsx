import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@radix-ui/react-dropdown-menu';
import { SparklesIcon } from 'lucide-react';
import { memo } from 'react';
import { Button } from '../ui/button';

function PureMCPButton({
  mcpTools,
}: { mcpTools: { title: string; description: string }[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="rounded-md rounded-bl-lg p-2 h-fit flex items-center gap-1.5 dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
          data-testid="mcp-tools-button"
        >
          <SparklesIcon size={14} />
          <span className="text-xs font-medium">Tools</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-white rounded-lg border border-zinc-200">
        <DropdownMenuLabel className="text-sm font-medium p-2">
          Available MCP Tools
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {mcpTools.length > 0 ? (
          mcpTools.map((tool) => (
            <DropdownMenuItem
              key={tool.title}
              className="flex flex-col items-start py-2 hover:bg-zinc-100 cursor-pointer p-3"
            >
              <span className="font-medium text-sm">{tool.title}</span>
              {tool.description && (
                <span className="text-xs text-muted-foreground mt-0.5">
                  {tool.description}
                </span>
              )}
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>No tools available</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const MCPButton = memo(PureMCPButton);
