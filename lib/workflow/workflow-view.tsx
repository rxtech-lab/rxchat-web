'use client';

import { cn } from '@/lib/utils';
import type { Edge, Node } from '@xyflow/react';
import {
  Background,
  ConnectionMode,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Clock, Code, GitBranch, Wrench, Zap } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import type {
  Workflow,
  BaseNode,
  ToolNode,
  ConditionNode,
  ConverterNode,
  TriggerNode,
  CronjobTriggerNode,
} from './types';

// Union type for all possible workflow nodes
type WorkflowNode =
  | ToolNode
  | ConditionNode
  | ConverterNode
  | TriggerNode
  | CronjobTriggerNode;

// Custom node components
const TriggerNodeComponent = ({
  data,
}: { data: CronjobTriggerNode | TriggerNode }) => (
  <div
    className={cn(
      'px-4 py-3 rounded-lg border-2 min-w-[200px]',
      'bg-green-50 border-green-300 shadow-md',
    )}
  >
    <Handle type="source" position={Position.Bottom} />
    <div className="flex items-center gap-2 mb-1">
      <Clock className="size-4 text-green-600" />
      <span className="font-semibold text-green-800">Cronjob Trigger</span>
    </div>
    <div className="text-sm text-green-700">
      <div>
        Schedule:{' '}
        <code className="bg-green-100 px-1 rounded">
          {data.type === 'cronjob-trigger' ? data.cron : 'Manual'}
        </code>
      </div>
      <div className="text-xs text-green-600 mt-1">ID: {data.identifier}</div>
    </div>
  </div>
);

const ToolNodeComponent = ({ data }: { data: ToolNode }) => (
  <div
    className={cn(
      'px-4 py-3 rounded-lg border-2 min-w-[200px]',
      'bg-blue-50 border-blue-300 shadow-md',
    )}
  >
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} />
    <div className="flex items-center gap-2 mb-1">
      <Wrench className="size-4 text-blue-600" />
      <span className="font-semibold text-blue-800">Tool</span>
    </div>
    <div className="text-sm text-blue-700">
      <div>
        Tool:{' '}
        <span className="font-mono bg-blue-100 px-1 rounded">
          {data.toolIdentifier || 'Unknown'}
        </span>
      </div>
      <div className="text-xs text-blue-600 mt-1">ID: {data.identifier}</div>
    </div>
  </div>
);

const ConditionNodeComponent = ({ data }: { data: ConditionNode }) => (
  <div
    className={cn(
      'px-4 py-3 rounded-lg border-2 min-w-[200px]',
      'bg-yellow-50 border-yellow-300 shadow-md',
    )}
  >
    <div className="flex items-center gap-2 mb-1">
      <GitBranch className="size-4 text-yellow-600" />
      <span className="font-semibold text-yellow-800">Condition</span>
    </div>
    <div className="text-sm text-yellow-700">
      <div>
        Runtime:{' '}
        <span className="font-mono bg-yellow-100 px-1 rounded">
          {data.runtime}
        </span>
      </div>
      <div className="text-xs text-yellow-600 mt-1">
        Children: {data.children?.length || 0}
      </div>
      <div className="text-xs text-yellow-600">ID: {data.identifier}</div>
    </div>
  </div>
);

const ConverterNodeComponent = ({ data }: { data: ConverterNode }) => (
  <div
    className={cn(
      'px-4 py-3 rounded-lg border-2 min-w-[200px]',
      'bg-purple-50 border-purple-300 shadow-md',
    )}
  >
    <div className="flex items-center gap-2 mb-1">
      <Code className="size-4 text-purple-600" />
      <span className="font-semibold text-purple-800">Converter</span>
    </div>
    <div className="text-sm text-purple-700">
      <div>
        Converter:{' '}
        <span className="font-mono bg-purple-100 px-1 rounded">
          {data.converter}
        </span>
      </div>
      <div>
        Runtime:{' '}
        <span className="font-mono bg-purple-100 px-1 rounded">
          {data.runtime}
        </span>
      </div>
      <div className="text-xs text-purple-600 mt-1">ID: {data.identifier}</div>
    </div>
  </div>
);

const DefaultNodeComponent = ({
  data,
}: { data: BaseNode & { type?: string } }) => (
  <div
    className={cn(
      'px-4 py-3 rounded-lg border-2 min-w-[200px]',
      'bg-gray-50 border-gray-300 shadow-md',
    )}
  >
    <div className="flex items-center gap-2 mb-1">
      <Zap className="size-4 text-gray-600" />
      <span className="font-semibold text-gray-800">
        {data.type || 'Unknown'}
      </span>
    </div>
    <div className="text-sm text-gray-700">
      <div className="text-xs text-gray-600">ID: {data.identifier}</div>
    </div>
  </div>
);

// Node type mapping
const nodeTypes = {
  trigger: TriggerNodeComponent,
  'cronjob-trigger': TriggerNodeComponent,
  tool: ToolNodeComponent,
  condition: ConditionNodeComponent,
  converter: ConverterNodeComponent,
  default: DefaultNodeComponent,
};

interface WorkflowViewProps {
  workflow: Workflow;
  className?: string;
}

/**
 * Internal component that handles auto-zoom functionality using useReactFlow hook
 */
function WorkflowFlowComponent({
  nodes,
  edges,
}: {
  nodes: Node[];
  edges: Edge[];
}) {
  const reactFlowInstance = useReactFlow();

  // Auto-fit the view when nodes or edges change
  useEffect(() => {
    if (nodes.length > 0) {
      // Use setTimeout to ensure the nodes are rendered before fitting
      setTimeout(() => {
        reactFlowInstance.fitView({
          padding: 5, // Minimal padding for maximum display size
          includeHiddenNodes: false,
          minZoom: 2.0, // Force much larger display
          maxZoom: 10, // Higher maximum zoom
          duration: 800, // Smooth animation duration
        });
      }, 100);
    }
  }, [nodes, edges, reactFlowInstance]);

  return (
    <>
      <Controls />
      <MiniMap
        className="bg-white border border-gray-300"
        nodeColor={(node) => {
          switch (node.type) {
            case 'cronjob-trigger':
            case 'trigger':
              return '#10b981';
            case 'tool':
              return '#3b82f6';
            case 'condition':
              return '#f59e0b';
            case 'converter':
              return '#8b5cf6';
            default:
              return '#6b7280';
          }
        }}
      />
      <Background />
    </>
  );
}

export function WorkflowView({ workflow, className }: WorkflowViewProps) {
  // Build nodes and edges from workflow structure
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Helper function to build nodes and edges recursively while maintaining order
    const processNode = (
      node: WorkflowNode | null | undefined,
      yPosition: number,
      visited = new Set<string>(),
    ): number => {
      // Robust null/undefined checks
      if (!node || typeof node !== 'object' || !node.identifier) {
        return yPosition;
      }

      if (visited.has(node.identifier)) {
        return yPosition;
      }

      visited.add(node.identifier);

      const xPosition = 200; // Center position
      const ySpacing = 150; // Vertical spacing between nodes

      // Create the current node
      const flowNode: Node = {
        id: node.identifier,
        type: node.type || 'default',
        position: { x: xPosition, y: yPosition },
        data: node,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      };

      nodes.push(flowNode);
      let nextYPosition = yPosition + ySpacing;

      // Handle child (singular) - for ToolNode, ConverterNode, TriggerNode, CronjobTriggerNode
      if ('child' in node && node.child) {
        const child = node.child;
        if (
          child &&
          typeof child === 'object' &&
          'identifier' in child &&
          child.identifier
        ) {
          edges.push({
            id: `${node.identifier}-${child.identifier}`,
            source: node.identifier,
            target: child.identifier,
            type: 'default',
            animated: true,
          });
          nextYPosition = processNode(
            child as WorkflowNode,
            nextYPosition,
            visited,
          );
        }
      }

      // Handle children (array) - for ConditionNode
      if ('children' in node && Array.isArray(node.children)) {
        node.children.forEach((child) => {
          if (
            child &&
            typeof child === 'object' &&
            'identifier' in child &&
            child.identifier
          ) {
            edges.push({
              id: `${node.identifier}-${child.identifier}`,
              source: node.identifier,
              target: child.identifier,
              type: 'default',
              animated: true,
            });
            nextYPosition = processNode(
              child as WorkflowNode,
              nextYPosition,
              visited,
            );
          }
        });
      }

      return nextYPosition;
    };

    // Start processing from trigger
    processNode(workflow.trigger, 0);

    return { nodes, edges };
  }, [workflow]);

  return (
    <div className={cn('w-full h-full bg-gray-50', className)}>
      <div className="h-full">
        <ReactFlow
          nodes={initialNodes}
          edges={initialEdges}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Strict}
          fitView
          fitViewOptions={{
            padding: 20,
            includeHiddenNodes: false,
          }}
          elementsSelectable={false}
          nodesConnectable={false}
          nodesDraggable={false}
        >
          <WorkflowFlowComponent nodes={initialNodes} edges={initialEdges} />
        </ReactFlow>
      </div>
    </div>
  );
}

export default WorkflowView;
