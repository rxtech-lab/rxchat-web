import type { ComponentProps } from 'react';

import { useRightSidebar } from '@/components/ui/right-sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { FileIcon } from './icons';
import { Button } from './ui/button';

export function RightSidebarToggle({ className }: ComponentProps<'button'>) {
  const { toggleSidebar } = useRightSidebar();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          data-testid="right-sidebar-toggle-button"
          onClick={toggleSidebar}
          variant="outline"
          className="md:px-2 md:h-fit"
        >
          <FileIcon size={16} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" align="center">
        Toggle Documents
      </TooltipContent>
    </Tooltip>
  );
}
