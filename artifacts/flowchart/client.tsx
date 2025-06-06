import { Artifact } from '@/components/create-artifact';
import { DocumentSkeleton } from '@/components/document-skeleton';

import type { Suggestion } from '@/lib/db/schema';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';

// React Flow imports
import { ClockRewind } from '@/components/icons';
import { WorkflowSchema, type Workflow } from '@/lib/workflow/types';
import '@xyflow/react/dist/style.css';
import { CopyIcon, PenIcon, RedoIcon, UndoIcon, ZapIcon } from 'lucide-react';
import WorkflowView from '@/lib/workflow/workflow-view';

/**
 * Interface for flowchart metadata containing suggestions and workflow steps
 */
interface FlowchartArtifactMetadata {
  suggestions: Array<Suggestion>;
  workflowSteps?: Array<{
    step: number;
    agent: string;
    status: 'running' | 'completed' | 'error';
    message: string;
    result?: any;
  }>;
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
      workflowSteps: [],
    });
  },
  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    if (streamPart.type === 'suggestion') {
      setMetadata((metadata) => ({
        ...metadata,
        suggestions: [
          ...metadata.suggestions,
          streamPart.content as Suggestion,
        ],
      }));
    }

    // Handle custom stream parts for workflow steps
    if ((streamPart as any).type === 'flow-step') {
      setMetadata((metadata) => {
        const currentMetadata = metadata || {
          suggestions: [],
          workflowSteps: [],
        };
        return {
          ...currentMetadata,
        };
      });
    }

    // Handle custom stream parts for flowchart content
    if ((streamPart as any).type === 'flowchart-delta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: (streamPart as any).content as string,
        isVisible: true,
        status: 'streaming',
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

    // try parse the content
    let workflow: Workflow | null = null;
    try {
      const jsonObject = JSON.parse(content);
      workflow = jsonObject.workflow;
      const parsed = WorkflowSchema.safeParse(jsonObject);
      if (parsed.success) {
        workflow = parsed.data;
      } else {
        console.log('jsonObject', jsonObject);
        console.error('Error parsing workflow:', parsed.error);
      }
    } catch (error) {}

    if (!workflow) {
      return <div />;
    }

    return (
      <div className="h-full">
        <WorkflowView workflow={workflow} />
      </div>
    );
  },
  actions: [
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
