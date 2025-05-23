'use client';

import { ChevronsUpDown } from 'lucide-react';
import { startTransition, useMemo, useOptimistic, useState } from 'react';

import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import type { Providers } from '@/lib/ai/models';
import type { Session } from 'next-auth';

export function ModelSelector({
  selectedModelId,
  className,
  providers,
}: {
  session: Session;
  selectedModelId: string;
  providers: Providers;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId);
  const [search, setSearch] = useState('');

  const selectedChatModel = useMemo(() => {
    const provider = Object.values(providers).find((provider) =>
      provider.models.find((model) => model.id === optimisticModelId),
    );

    return provider?.models.find((model) => model.id === optimisticModelId);
  }, [optimisticModelId, providers]);

  // Create a flat array of all models with provider information
  const filteredModels = useMemo(() => {
    const allModels = Object.values(providers).flatMap((provider) =>
      provider.models
        .map((model) => ({
          ...model,
          providerName: provider.provider,
        }))
        .filter((model) => {
          if (search === '') {
            return true;
          }
          return model.name.toLowerCase().includes(search.toLowerCase());
        }),
    );

    // Sort to put the selected model at the top
    return allModels.sort((a, b) => {
      if (a.id === optimisticModelId) return -1;
      if (b.id === optimisticModelId) return 1;
      return 0;
    });
  }, [providers, search, optimisticModelId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          data-testid="model-selector"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'md:px-2 md:h-[34px] justify-between md:w-[300px] w-[150px]',
            className,
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {selectedChatModel?.name || 'Select model...'}
          </div>
          <ChevronsUpDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-w-2xl p-0">
        <Command>
          <CommandInput
            placeholder="Search models..."
            className="h-9"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filteredModels.length > 0 ? (
              filteredModels.map((model) => (
                <CommandItem
                  key={model.id}
                  value={model.id}
                  forceMount
                  onSelect={(currentValue) => {
                    startTransition(() => {
                      setOptimisticModelId(currentValue);
                      saveChatModelAsCookie(currentValue, model.providerName);
                    });
                    setOpen(false);
                  }}
                  data-testid={`model-selector-item-${model.id}`}
                  className={cn(
                    'flex flex-col gap-1 items-start w-full',
                    model.id === optimisticModelId &&
                      'bg-primary text-primary-foreground hover:!bg-primary hover:!text-primary-foreground',
                  )}
                >
                  <div className="flex items-center gap-2 justify-between w-full">
                    <span>{model.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {model.providerName}
                    </Badge>
                  </div>
                </CommandItem>
              ))
            ) : (
              <CommandEmpty>No model found.</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
