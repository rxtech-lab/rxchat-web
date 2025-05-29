'use client';

import { ChevronsUpDown } from 'lucide-react';
import {
  startTransition,
  useMemo,
  useOptimistic,
  useState,
  useEffect,
} from 'react';

import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

  // Get unique provider names from accessible providers only (providers with models)
  const accessibleProviders = useMemo(() => {
    return Object.values(providers).filter(
      (provider) => provider.models.length > 0,
    );
  }, [providers]);

  // Initialize with only accessible providers enabled, but will be overridden by localStorage
  const [enabledProviders, setEnabledProviders] = useState<Set<string>>(
    new Set(accessibleProviders.map((p) => p.provider)),
  );

  // Load provider filter state from localStorage on mount, but only include accessible providers
  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem(
        'model-selector-enabled-providers',
      );
      const accessibleProviderNames = new Set(
        accessibleProviders.map((p) => p.provider),
      );

      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        if (Array.isArray(parsed)) {
          // Only enable providers that are both saved and accessible to the user
          const filteredEnabled = parsed.filter((providerName) =>
            accessibleProviderNames.has(providerName),
          );
          setEnabledProviders(new Set(filteredEnabled));
        }
      } else {
        // If no saved filters, enable all accessible providers
        setEnabledProviders(accessibleProviderNames);
      }
    } catch (error) {
      console.warn('Failed to load provider filters from localStorage:', error);
      // Fallback to all accessible providers
      setEnabledProviders(new Set(accessibleProviders.map((p) => p.provider)));
    }
  }, [accessibleProviders]);

  // Save provider filter state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(
        'model-selector-enabled-providers',
        JSON.stringify(Array.from(enabledProviders)),
      );
    } catch (error) {
      console.warn('Failed to save provider filters to localStorage:', error);
    }
  }, [enabledProviders]);

  const selectedChatModel = useMemo(() => {
    const provider = accessibleProviders.find((provider) =>
      provider.models.find((model) => model.id === optimisticModelId),
    );

    return provider?.models.find((model) => model.id === optimisticModelId);
  }, [optimisticModelId, accessibleProviders]);

  // Get unique provider names from accessible providers only
  const providerNames = useMemo(() => {
    return accessibleProviders.map((p) => p.provider);
  }, [accessibleProviders]);

  // Toggle provider enabled state
  const toggleProvider = (providerName: string) => {
    setEnabledProviders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(providerName)) {
        newSet.delete(providerName);
      } else {
        newSet.add(providerName);
      }
      return newSet;
    });
  };

  // Create a flat array of all models with provider information from accessible providers only
  const filteredModels = useMemo(() => {
    const allModels = accessibleProviders.flatMap((provider) =>
      provider.models
        .map((model) => ({
          ...model,
          providerName: provider.provider,
        }))
        .filter((model) => {
          // Filter by enabled providers
          if (!enabledProviders.has(model.providerName)) {
            return false;
          }

          // Filter by search term
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
  }, [accessibleProviders, search, optimisticModelId, enabledProviders]);

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
      <PopoverContent className="w-[320px] sm:w-[460px] md:w-[540px] p-0">
        <div className="flex flex-col md:flex-row h-[400px]">
          {/* Provider Filter Sidebar - Desktop */}
          <div className="hidden md:flex shrink-0 md:basic-1/3 md:flex-col md:basis-1/3 md:max-w-xs border-r bg-muted/30">
            <div className="p-3 border-b">
              <h4 className="text-sm font-medium">Providers</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Filter models by provider
              </p>
            </div>
            <div className="p-2 space-y-2 flex-1 overflow-y-auto">
              {providerNames.map((providerName) => (
                <div
                  key={providerName}
                  className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleProvider(providerName);
                  }}
                >
                  <Checkbox
                    checked={enabledProviders.has(providerName)}
                    onCheckedChange={() => toggleProvider(providerName)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">
                      {providerName}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {accessibleProviders.find(
                          (p) => p.provider === providerName,
                        )?.models.length || 0}{' '}
                        models
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Provider Filter Chips - Mobile */}
          <div className="block md:hidden border-b bg-muted/30">
            <div className="p-3 border-b">
              <h4 className="text-sm font-medium">Providers</h4>
            </div>
            <div className="p-1">
              <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                {providerNames.map((providerName) => {
                  const isEnabled = enabledProviders.has(providerName);
                  const modelCount =
                    accessibleProviders.find((p) => p.provider === providerName)
                      ?.models.length || 0;

                  return (
                    <button
                      key={providerName}
                      type="button"
                      onClick={() => toggleProvider(providerName)}
                      className={cn(
                        'flex items-center gap-1.5 px-1 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0',
                        isEnabled
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background border border-border hover:bg-accent',
                      )}
                    >
                      {providerName}
                      <Badge
                        variant={isEnabled ? 'secondary' : 'outline'}
                        className="text-xs ml-1"
                      >
                        {modelCount}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Models List */}
          <div className="flex-1 min-h-0 md:basis-2/3">
            <Command>
              <CommandInput
                placeholder="Search models..."
                className="h-9 border-0 rounded-none"
                value={search}
                onValueChange={setSearch}
              />
              <CommandList className="max-h-[240px] md:max-h-[350px]">
                {filteredModels.length > 0 ? (
                  filteredModels.map((model) => (
                    <CommandItem
                      key={model.id}
                      value={model.id}
                      forceMount
                      onSelect={(currentValue) => {
                        startTransition(() => {
                          setOptimisticModelId(currentValue);
                          saveChatModelAsCookie(
                            currentValue,
                            model.providerName,
                          );
                        });
                        setOpen(false);
                      }}
                      data-testid={`model-selector-item-${model.id}`}
                      className={cn(
                        'flex flex-col gap-1 items-start w-full p-3 m-1 rounded-md',
                        model.id === optimisticModelId &&
                          'bg-primary text-primary-foreground hover:!bg-primary hover:!text-primary-foreground',
                      )}
                    >
                      <div className="flex flex-col gap-1 w-full">
                        <span className="font-medium text-xs sm:text-sm truncate max-w-[220px]">
                          {model.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-xs shrink-0 self-start"
                        >
                          {model.providerName}
                        </Badge>
                      </div>
                    </CommandItem>
                  ))
                ) : (
                  <CommandEmpty>
                    <div className="text-center p-4">
                      <p className="text-sm">
                        {enabledProviders.size === 0
                          ? 'Please select at least one provider to see models.'
                          : 'No models found matching your search.'}
                      </p>
                    </div>
                  </CommandEmpty>
                )}
              </CommandList>
            </Command>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
