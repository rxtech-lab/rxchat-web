import { Artifact } from '@/components/create-artifact';
import { DocumentSkeleton } from '@/components/document-skeleton';
import React, { useCallback, useEffect, useState } from 'react';

import type { Suggestion } from '@/lib/db/schema';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';

// React Flow imports
import { ClockRewind } from '@/components/icons';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CopyIcon, PenIcon, RedoIcon, UndoIcon, ZapIcon } from 'lucide-react';

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
 * Interface for workflow data structure
 */
interface WorkflowData {
  query: string;
  toolDiscovery?: {
    selectedTools: any[];
    reasoning: string;
  };
  workflow: {
    nodes: Node[];
    edges: Edge[];
  };
  toolSchemas?: any[];
  suggestions?: {
    suggestions: string[];
    modifications: any[];
    nextSteps: string[];
  };
  metadata?: {
    createdAt: string;
    agents: string[];
    stepCount: number;
  };
  error?: string;
}

/**
 * Custom node types for different workflow components
 */
const nodeTypes = {
  input: ({ data }: { data: any }) => (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-blue-50 border-2 border-blue-400 dark:bg-blue-950 dark:border-blue-500 min-w-[180px] max-w-[280px]">
      <div className="font-bold text-blue-900 dark:text-blue-100 text-base leading-tight">
        {data.label}
      </div>
    </div>
  ),
  output: ({ data }: { data: any }) => (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-green-50 border-2 border-green-400 dark:bg-green-950 dark:border-green-500 min-w-[180px] max-w-[280px]">
      <div className="font-bold text-green-900 dark:text-green-100 text-base leading-tight">
        {data.label}
      </div>
    </div>
  ),
  tool: ({ data }: { data: any }) => (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-purple-50 border-2 border-purple-400 dark:bg-purple-950 dark:border-purple-500 min-w-[180px] max-w-[280px]">
      <div className="font-bold text-purple-900 dark:text-purple-100 text-base mb-2 leading-tight">
        {data.label}
      </div>
      {data.toolName && (
        <div className="text-xs font-mono text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded">
          {data.toolName}
        </div>
      )}
    </div>
  ),
  conversion: ({ data }: { data: any }) => (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-orange-50 border-2 border-orange-400 dark:bg-orange-950 dark:border-orange-500 min-w-[180px] max-w-[280px]">
      <div className="font-bold text-orange-900 dark:text-orange-100 text-base leading-tight">
        {data.label}
      </div>
    </div>
  ),
  default: ({ data }: { data: any }) => (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-gray-50 border-2 border-gray-400 dark:bg-gray-950 dark:border-gray-500 min-w-[180px] max-w-[280px]">
      <div className="font-bold text-gray-900 dark:text-gray-100 text-base mb-2 leading-tight">
        {data.label}
      </div>
      {data.description && (
        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {data.description}
        </div>
      )}
    </div>
  ),
};

/**
 * Automatic layout function for top-down flow with proper spacing
 */
const applyAutoLayout = (nodes: Node[], edges: Edge[]): Node[] => {
  if (nodes.length === 0) return nodes;

  // Create adjacency list to understand node relationships
  const adjacencyList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize
  nodes.forEach((node) => {
    adjacencyList.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  // Build graph from edges
  edges.forEach((edge) => {
    if (adjacencyList.has(edge.source) && inDegree.has(edge.target)) {
      const sourceList = adjacencyList.get(edge.source);
      if (sourceList) {
        sourceList.push(edge.target);
      }
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  });

  // Topological sort to determine levels
  const levels: string[][] = [];
  const queue: string[] = [];
  const visited = new Set<string>();

  // Find nodes with no incoming edges (start nodes)
  nodes.forEach((node) => {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  });

  // If no start nodes found, treat first node as start
  if (queue.length === 0 && nodes.length > 0) {
    queue.push(nodes[0].id);
  }

  while (queue.length > 0) {
    const currentLevel: string[] = [];
    const levelSize = queue.length;

    for (let i = 0; i < levelSize; i++) {
      const nodeId = queue.shift();
      if (!nodeId || visited.has(nodeId)) continue;

      visited.add(nodeId);
      currentLevel.push(nodeId);

      // Add children to next level
      const children = adjacencyList.get(nodeId) || [];
      children.forEach((childId) => {
        if (!visited.has(childId)) {
          const newInDegree = (inDegree.get(childId) || 0) - 1;
          inDegree.set(childId, newInDegree);
          if (newInDegree <= 0) {
            queue.push(childId);
          }
        }
      });
    }

    if (currentLevel.length > 0) {
      levels.push(currentLevel);
    }
  }

  // Add any remaining unvisited nodes to the end
  const unvisited = nodes.filter((node) => !visited.has(node.id));
  if (unvisited.length > 0) {
    levels.push(unvisited.map((node) => node.id));
  }

  // Calculate positions with improved spacing
  const nodeWidth = 280; // Max width of nodes
  const nodeHeight = 120; // Estimated height
  const horizontalSpacing = 100; // Space between nodes in same level
  const verticalSpacing = 150; // Space between levels
  const startX = 50;
  const startY = 50;

  const positionedNodes = nodes.map((node) => {
    // Find which level this node is in
    let levelIndex = 0;
    let nodeIndexInLevel = 0;

    for (let i = 0; i < levels.length; i++) {
      const nodeIndex = levels[i].indexOf(node.id);
      if (nodeIndex !== -1) {
        levelIndex = i;
        nodeIndexInLevel = nodeIndex;
        break;
      }
    }

    const level = levels[levelIndex];
    const totalWidthOfLevel =
      level.length * nodeWidth + (level.length - 1) * horizontalSpacing;
    const levelStartX = startX + Math.max(0, (600 - totalWidthOfLevel) / 2); // Center the level

    const x = levelStartX + nodeIndexInLevel * (nodeWidth + horizontalSpacing);
    const y = startY + levelIndex * (nodeHeight + verticalSpacing);

    return {
      ...node,
      position: { x, y },
    };
  });

  return positionedNodes;
};

/**
 * FlowchartEditor component renders the workflow using React Flow
 */
const FlowchartEditor: React.FC<{
  content: string;
  isCurrentVersion: boolean;
  status: 'streaming' | 'idle';
  onSaveContent: (content: string, debounce: boolean) => void;
  metadata?: FlowchartArtifactMetadata;
}> = ({ content, isCurrentVersion, status, onSaveContent, metadata }) => {
  const [workflowData, setWorkflowData] = useState<WorkflowData | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [error, setError] = useState<string | null>(null);

  // Parse workflow content
  useEffect(() => {
    if (content) {
      try {
        const parsed = JSON.parse(content) as WorkflowData;
        setWorkflowData(parsed);
        setError(null);

        // Set nodes and edges for React Flow with auto-layout
        if (parsed.workflow?.nodes && parsed.workflow?.edges) {
          const layoutedNodes = applyAutoLayout(
            parsed.workflow.nodes,
            parsed.workflow.edges,
          );
          setNodes(layoutedNodes);
          setEdges(parsed.workflow.edges);
        } else if (parsed.workflow?.nodes) {
          const layoutedNodes = applyAutoLayout(parsed.workflow.nodes, []);
          setNodes(layoutedNodes);
        }
      } catch (err) {
        console.error('Failed to parse workflow content:', err);
        setError('Failed to parse workflow data');
        setWorkflowData(null);
      }
    }
  }, [content, setNodes, setEdges]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 text-center">
          <p className="font-bold">Error loading workflow</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!workflowData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading workflow...</div>
      </div>
    );
  }

  return (
    <div className="size-full">
      {/* React Flow Canvas - Full Screen */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{
          padding: 0.2,
          includeHiddenNodes: false,
        }}
        attributionPosition="bottom-left"
        className="bg-background"
        defaultEdgeOptions={{
          style: { strokeWidth: 2, stroke: '#94a3b8' },
          type: 'smoothstep',
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap
          style={{
            height: 120,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid #e2e8f0',
          }}
          nodeColor={(node) => {
            switch (node.type) {
              case 'input':
                return '#3b82f6';
              case 'output':
                return '#10b981';
              case 'tool':
                return '#8b5cf6';
              case 'conversion':
                return '#f59e0b';
              default:
                return '#6b7280';
            }
          }}
          zoomable
          pannable
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="#e2e8f0"
        />
      </ReactFlow>
    </div>
  );
};

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
      const stepData = JSON.parse((streamPart as any).content as string);
      setMetadata((metadata) => {
        const currentMetadata = metadata || {
          suggestions: [],
          workflowSteps: [],
        };
        return {
          ...currentMetadata,
          workflowSteps: [
            ...(currentMetadata.workflowSteps || []).filter(
              (step) => step.step !== stepData.step,
            ),
            stepData,
          ],
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
  content: ({
    mode,
    status,
    content,
    isCurrentVersion,
    onSaveContent,
    isLoading,
    metadata,
  }) => {
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

    return (
      <div className="h-full">
        <FlowchartEditor
          content={content}
          isCurrentVersion={isCurrentVersion}
          status={status}
          onSaveContent={onSaveContent}
          metadata={metadata}
        />
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
