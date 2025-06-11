import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { artifactDefinitions, type UIArtifact } from './artifact';
import { type Dispatch, memo, type SetStateAction, useState } from 'react';
import type { ArtifactActionContext } from './create-artifact';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader } from 'lucide-react';

interface ArtifactActionsProps {
  artifact: UIArtifact;
  handleVersionChange: (type: 'next' | 'prev' | 'toggle' | 'latest') => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  mode: 'edit' | 'diff';
  metadata: any;
  setMetadata: Dispatch<SetStateAction<any>>;
}

function PureArtifactActions({
  artifact,
  handleVersionChange,
  currentVersionIndex,
  isCurrentVersion,
  mode,
  metadata,
  setMetadata,
}: ArtifactActionsProps) {
  const [loadingActionIndex, setLoadingActionIndex] = useState<number | null>(
    null,
  );

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  );

  if (!artifactDefinition) {
    throw new Error('Artifact definition not found!');
  }

  const actionContext: ArtifactActionContext = {
    content: artifact.content,
    documentId: artifact.documentId,
    handleVersionChange,
    currentVersionIndex,
    isCurrentVersion,
    mode,
    metadata,
    setMetadata,
  };

  return (
    <div className="flex flex-row gap-1">
      {artifactDefinition.actions.map((action, index) => {
        const isActionLoading = loadingActionIndex === index;

        return (
          <Tooltip key={action.description}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={cn('h-fit dark:hover:bg-zinc-700', {
                  'p-2': !action.label,
                  'py-1.5 px-2': action.label,
                })}
                onClick={async () => {
                  setLoadingActionIndex(index);

                  try {
                    await Promise.resolve(action.onClick(actionContext));
                  } catch (error) {
                    toast.error('Failed to execute action');
                  } finally {
                    setLoadingActionIndex(null);
                  }
                }}
                disabled={
                  loadingActionIndex !== null || artifact.status === 'streaming'
                    ? true
                    : action.isDisabled
                      ? action.isDisabled(actionContext)
                      : false
                }
              >
                {isActionLoading ? (
                  <Loader className="animate-spin size-4 text-zinc-500" />
                ) : (
                  action.icon
                )}
                {action.label}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{action.description}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export const ArtifactActions = memo(
  PureArtifactActions,
  (prevProps, nextProps) => {
    if (prevProps.artifact.status !== nextProps.artifact.status) return false;
    if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex)
      return false;
    if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) return false;
    if (prevProps.artifact.content !== nextProps.artifact.content) return false;

    return true;
  },
);
