'use client';

// Removed ScrollArea import - using div with overflow-y-auto instead
import type { Prompt } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import { Edit, Loader2, Pin, Plus, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Badge } from './ui/badge';
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
  const { data: session } = useSession();
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
                <Plus className="size-4" />
                Create your first prompt
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-2 p-2">
            {prompts.map((prompt) => {
              const isLoading = loadingPromptId === prompt.id;
              const isSelected = selectedPromptId === prompt.id;
              const isEditable = prompt.authorId === session?.user.id;

              return (
                // biome-ignore lint/nursery/noStaticElementInteractions: <explanation>
                <div
                  key={prompt.id}
                  className={cn(
                    'group p-3 border-gray-200 border rounded-2xl cursor-pointer transition-all duration-200 hover:bg-muted/50 hover:shadow-lg bg-white relative',
                    isLoading && 'opacity-75 cursor-wait',
                    isSelected && 'border-primary border-2',
                  )}
                  onClick={() => !isLoading && onSelect(prompt)}
                >
                  {isLoading && (
                    <div className="absolute inset-0 bg-background/50 rounded-2xl flex items-center justify-center z-10">
                      <Loader2 className="size-6 animate-spin text-primary" />
                    </div>
                  )}

                  {/* Pin icon for selected prompt */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 bg-primary rounded-full p-2 shadow-sm z-20">
                      <Pin className="size-4 text-primary-foreground fill-current" />
                    </div>
                  )}

                  {/* Action buttons */}
                  {isEditable && (
                    <div
                      className={cn(
                        'absolute top-10 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
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
                        className="size-8 p-0 hover:bg-gray-100"
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
                        className="size-8 p-0 text-destructive hover:text-destructive hover:bg-red-50"
                        disabled={isLoading}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2 justify-between flex-col flex h-full">
                    {/* Icon, Title, and Tags in same row */}
                    <div className="flex items-start gap-2">
                      {/* Icon */}
                      {prompt.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={`icon-${prompt.title}`}
                          src={prompt.icon}
                          className="size-12 flex items-center justify-center text-2xl shrink-0"
                        />
                      ) : (
                        <div className="size-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center shrink-0">
                          <span className="text-blue-600 text-lg font-bold">
                            {prompt.title.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Title and Tags Column */}
                      <div className="flex flex-col gap-2 flex-1 min-w-0">
                        {/* Title */}
                        <h3
                          className={cn(
                            'text font-bold text-gray-900 leading-tight',
                            isSelected && 'text-primary',
                          )}
                        >
                          {prompt.title}
                        </h3>

                        {/* Tags */}
                        {prompt.tags && prompt.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {prompt.tags.slice(0, 4).map((tag) => (
                              <Badge
                                key={`${prompt.id}-${tag}`}
                                className="rounded-full px-3 py-1 font-medium bg-cyan-100 text-cyan-800 border-0 hover:bg-cyan-200"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {prompt.tags.length > 4 && (
                              <Badge
                                variant="outline"
                                className="rounded-full px-3 py-1 text-sm text-gray-600 border-gray-300"
                              >
                                +{prompt.tags.length - 4}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1">
                      {/* Description */}
                      {prompt.description ? (
                        <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 flex-1">
                          {prompt.description}
                        </p>
                      ) : (
                        <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 flex-1">
                          No description
                        </p>
                      )}
                    </div>

                    {/* Footer info */}
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                      <span className="capitalize">{prompt.visibility}</span>
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
