import { Artifact } from '@/components/create-artifact';
import { DocumentSkeleton } from '@/components/document-skeleton';

import { toast } from 'sonner';
import { getSuggestions } from '../actions';

// React Flow imports
import { ClockRewind } from '@/components/icons';
import type { Suggestion } from '@/lib/db/schema';
import OnStepView from '@/lib/workflow/onstep-view';
import { OnStepSchema } from '@/lib/workflow/types';
import '@xyflow/react/dist/style.css';
import {
  CopyIcon,
  EyeIcon,
  PenIcon,
  PlayIcon,
  RedoIcon,
  UndoIcon,
  ZapIcon,
} from 'lucide-react';
import { createWorkflowJob } from '@/app/(chat)/actions';
import Link from 'next/link';

/**
 * Interface for flowchart metadata containing suggestions and workflow steps
 */
interface FlowchartArtifactMetadata {
  suggestions: Array<Suggestion>;
  showMainInfo: boolean;
}

/**
 * Main flowchart artifact definition
 */
export const flowchartArtifact = new Artifact<
  'flowchart',
  FlowchartArtifactMetadata
>({
  kind: 'flowchart',
  description:
    'Interactive workflow diagrams with multi-agent tool integration',
  initialize: async ({ documentId, setMetadata }) => {
    const suggestions = await getSuggestions({ documentId });
    setMetadata({
      suggestions,
      showMainInfo: true,
    });
  },
  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    // Handle custom stream parts for workflow steps
    if ((streamPart as any).type === 'flowchart-step-delta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: (streamPart as any).content as string,
      }));
    }

    // Handle custom stream parts for flowchart content
    if ((streamPart as any).type === 'flowchart-delta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: (streamPart as any).content as string,
        isVisible: true,
        status: 'idle',
      }));
    }
  },
  content: ({ mode, content, isLoading, metadata }) => {
    if (isLoading) {
      return <DocumentSkeleton artifactKind="flowchart" />;
    }

    if (mode === 'diff') {
      // For diff mode, show a simple text comparison
      return (
        <div className="p-8">
          <div className="text-muted-foreground text-center">
            Diff view not implemented for flowcharts yet
          </div>
        </div>
      );
    }

    try {
      const jsonObject = JSON.parse(content);
      const parsed = OnStepSchema.safeParse(jsonObject);
      if (parsed.success) {
        return (
          <OnStepView
            onStep={parsed.data}
            showMainInfo={metadata.showMainInfo}
          />
        );
      }
    } catch (error) {
      console.error('Error parsing OnStep:', error);
    }

    return <div />;
  },
  actions: [
    {
      description: 'Run workflow',
      icon: <PlayIcon size={18} />,
      onClick: async ({ documentId }) => {
        const job = await createWorkflowJob(documentId);
        toast.success(
          <div>
            Workflow job created successfully.
            <br />
            <Link href={`/jobs`} className="text-blue-500 underline">
              View jobs
            </Link>
          </div>,
        );
        return job;
      },
    },
    {
      icon: <EyeIcon size={18} />,
      description: 'Show main info',
      onClick: ({ setMetadata }) => {
        setMetadata((draftMetadata) => ({
          ...draftMetadata,
          showMainInfo: !draftMetadata.showMainInfo,
        }));
      },
    },
    {
      icon: <ClockRewind size={18} />,
      description: 'View changes',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('toggle');
      },
      isDisabled: ({ currentVersionIndex }) => {
        return currentVersionIndex === 0;
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        return currentVersionIndex === 0;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        return isCurrentVersion;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy workflow JSON',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Workflow JSON copied to clipboard!');
      },
    },
  ],
  toolbar: [
    {
      icon: <ZapIcon />,
      description: 'Optimize workflow',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content:
            'Please optimize this workflow by improving tool connections, adding error handling, and suggesting performance improvements.',
        });
      },
    },
    {
      icon: <PenIcon />,
      description: 'Add more tools',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content:
            'Please analyze the current workflow and suggest additional tools that could improve the solution.',
        });
      },
    },
  ],
});
