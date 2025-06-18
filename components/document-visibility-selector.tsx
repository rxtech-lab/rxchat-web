'use client';

import { type ReactNode, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  CheckCircleFillIcon,
  ChevronDownIcon,
  GlobeIcon,
  LockIcon,
} from './icons';
import { useDocumentVisibility } from '@/hooks/use-document-visibility';
import type { VisibilityType } from './visibility-selector';

const visibilities: Array<{
  id: VisibilityType;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    id: 'private',
    label: 'Private',
    description: 'Only you can access this document',
    icon: <LockIcon />,
  },
  {
    id: 'public',
    label: 'Public',
    description: 'Anyone can search and access this document',
    icon: <GlobeIcon />,
  },
];

export function DocumentVisibilitySelector({
  documentId,
  className,
  selectedVisibilityType,
  size = 'default',
}: {
  documentId: string;
  selectedVisibilityType: VisibilityType;
  size?: 'sm' | 'default';
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);

  const { visibilityType, setVisibilityType } = useDocumentVisibility({
    documentId,
    initialVisibilityType: selectedVisibilityType,
  });

  const selectedVisibility = useMemo(
    () => visibilities.find((visibility) => visibility.id === visibilityType),
    [visibilityType],
  );

  const handleVisibilityChange = async (newVisibility: VisibilityType) => {
    try {
      await setVisibilityType(newVisibility);
      setOpen(false);
    } catch (error) {
      console.error('Failed to update document visibility:', error);
      // toast.error('Failed to update document visibility');
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          className,
        )}
      >
        <Button
          variant="outline"
          size={size}
          className={cn(
            size === 'sm' ? 'px-2 h-8 text-xs' : 'px-2 h-[34px]',
            'flex items-center gap-1',
          )}
        >
          {selectedVisibility?.icon}
          {size === 'default' && selectedVisibility?.label}
          <ChevronDownIcon size={12} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[300px]">
        {visibilities.map((visibility) => (
          <DropdownMenuItem
            key={visibility.id}
            onSelect={() => handleVisibilityChange(visibility.id)}
            className="gap-4 group/item flex flex-row justify-between items-center cursor-pointer hover:bg-muted"
            data-active={visibility.id === visibilityType}
          >
            <div className="flex flex-col gap-1 items-start">
              <div className="flex items-center gap-2">
                {visibility.icon}
                {visibility.label}
              </div>
              {visibility.description && (
                <div className="text-xs text-muted-foreground">
                  {visibility.description}
                </div>
              )}
            </div>
            <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
              <CheckCircleFillIcon />
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
