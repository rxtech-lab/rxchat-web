'use client';

// Removed ScrollArea import - using div with overflow-y-auto instead
import type { Prompt } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import { Edit, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';

interface PromptListProps {
  prompts: Prompt[];
  onSelect: (prompt: Prompt) => void;
  onEdit: (prompt: Prompt) => void;
  onDelete: (prompt: Prompt) => void;
  onCreate?: () => void;
  selectedPromptId?: string;
  loadingPromptId?: string;
  className?: string;
}

/**
 * Component that displays a list of prompts with actions
 * @param prompts - Array of prompts to display
 * @param onSelect - Callback when a prompt is selected
 * @param onEdit - Callback when editing a prompt
 * @param onDelete - Callback when deleting a prompt
 * @param onCreate - Callback when creating a new prompt
 * @param selectedPromptId - ID of the currently selected prompt
 * @param loadingPromptId - ID of the prompt currently being loaded
 * @param className - Additional CSS classes
 */
export function PromptList({
  prompts,
  onSelect,
  onEdit,
  onDelete,
  onCreate,
  selectedPromptId,
  loadingPromptId,
  className,
}: PromptListProps) {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {prompts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="space-y-3">
            <p className="text-muted-foreground">No prompts available</p>
            {onCreate && (
              <Button
                onClick={onCreate}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create your first prompt
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
            {prompts.map((prompt) => {
              const isLoading = loadingPromptId === prompt.id;
              const isSelected = selectedPromptId === prompt.id;

              return (
                // biome-ignore lint/nursery/noStaticElementInteractions: <explanation>
                <div
                  key={prompt.id}
                  className={cn(
                    'group p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:bg-muted/50 hover:shadow-md h-[180px] flex flex-col relative',
                    isSelected && 'border-primary hover:scale-[1.02]',
                    isLoading && 'opacity-75 cursor-wait',
                  )}
                  onClick={() => !isLoading && onSelect(prompt)}
                >
                  {isLoading && (
                    <div className="absolute inset-0 bg-background/50 rounded-lg flex items-center justify-center z-10">
                      <Loader2 className="size-6 animate-spin text-primary" />
                    </div>
                  )}

                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-2">
                      <h4
                        className={cn(
                          'font-medium truncate flex-1 transition-colors',
                          isSelected && 'text-primary font-semibold',
                        )}
                      >
                        {prompt.title}
                      </h4>
                      <div
                        className={cn(
                          'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0',
                          isLoading && 'opacity-0',
                        )}
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(prompt);
                          }}
                          className="size-8 p-0"
                          disabled={isLoading}
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(prompt);
                          }}
                          className="size-8 p-0 text-destructive hover:text-destructive"
                          disabled={isLoading}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {prompt.description && (
                      <p className="text-sm text-muted-foreground line-clamp-4 flex-1">
                        {prompt.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto pt-2">
                      <span>{prompt.visibility}</span>
                      <span>•</span>
                      <span>
                        {new Date(prompt.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
