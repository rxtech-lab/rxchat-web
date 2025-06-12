'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import Editor from '@monaco-editor/react';
import cronstrue from 'cronstrue';
import type { Edge, Node } from '@xyflow/react';
import {
  Background,
  ConnectionMode,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Clock, Code, Eye, GitBranch, Wrench, Zap } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import type {
  BaseNode,
  ConditionNode,
  ConverterNode,
  CronjobTriggerNode,
  FixedInput,
  ToolNode,
  TriggerNode,
  Workflow,
} from './types';

// Union type for all possible workflow nodes
type WorkflowNode =
  | ToolNode
  | ConditionNode
  | ConverterNode
  | TriggerNode
  | CronjobTriggerNode
  | FixedInput;

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
        {data.type === 'cronjob-trigger' && data.cron ? (
          <div className="mt-1 space-y-1">
            <div className="text-sm font-medium">
              {(() => {
                try {
                  return cronstrue.toString(data.cron);
                } catch (error) {
                  return 'Invalid cron expression';
                }
              })()}
            </div>
            <code className="bg-green-100 px-1 rounded text-xs">
              {data.cron}
            </code>
          </div>
        ) : (
          <code className="bg-green-100 px-1 rounded">Manual</code>
        )}
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
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} />
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

const ConverterNodeComponent = ({ data }: { data: ConverterNode }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 min-w-[200px]',
        'bg-purple-50 border-purple-300 shadow-md',
      )}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <div className="flex items-center gap-2 mb-1">
        <Code className="size-4 text-purple-600" />
        <span className="font-semibold text-purple-800">Converter</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto p-1 size-6 text-purple-600 hover:text-purple-800 hover:bg-purple-100 z-10 relative"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsDialogOpen(true);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        >
          <Eye className="size-3" />
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Converter Code - {data.identifier}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <div className="text-sm text-gray-600">
                Runtime:{' '}
                <span className="font-mono bg-gray-100 px-1 rounded">
                  {data.runtime}
                </span>
              </div>
              <div
                className="border rounded-lg overflow-hidden"
                style={{ height: '500px' }}
              >
                <Editor
                  height="500px"
                  language="typescript"
                  theme="vs-light"
                  value={data.code}
                  options={{
                    readOnly: true,
                    minimap: { enabled: true },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on',
                  }}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="text-sm text-purple-700">
        <div>
          Code:{' '}
          <span className="font-mono bg-purple-100 px-1 rounded text-xs">
            {data.code.length > 20
              ? `${data.code.substring(0, 20)}...`
              : data.code}
          </span>
        </div>
        <div>
          Runtime:{' '}
          <span className="font-mono bg-purple-100 px-1 rounded">
            {data.runtime}
          </span>
        </div>
        <div className="text-xs text-purple-600 mt-1">
          ID: {data.identifier}
        </div>
      </div>
    </div>
  );
};

const FixedInputNodeComponent = ({ data }: { data: FixedInput }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 min-w-[200px]',
        'bg-orange-50 border-orange-300 shadow-md',
      )}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <div className="flex items-center gap-2 mb-1">
        <Zap className="size-4 text-orange-600" />
        <span className="font-semibold text-orange-800">Fixed Input</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto p-1 size-6 text-orange-600 hover:text-orange-800 hover:bg-orange-100 z-10 relative"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsDialogOpen(true);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        >
          <Eye className="size-3" />
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Fixed Input Output - {data.identifier}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <div className="text-sm text-gray-600">
                Output configuration that supports Jinja2 syntax for accessing
                input and context variables.
              </div>
              <div
                className="border rounded-lg overflow-hidden"
                style={{ height: '400px' }}
              >
                <Editor
                  height="400px"
                  language="json"
                  theme="vs-light"
                  value={JSON.stringify(data.output, null, 2)}
                  options={{
                    readOnly: true,
                    minimap: { enabled: true },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on',
                  }}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="text-sm text-orange-700">
        <div>
          Output:{' '}
          <span className="font-mono bg-orange-100 px-1 rounded text-xs">
            {Object.keys(data.output).length} key(s)
          </span>
        </div>
        <div className="text-xs text-orange-600 mt-1">
          Supports Jinja2 syntax
        </div>
        <div className="text-xs text-orange-600">ID: {data.identifier}</div>
      </div>
    </div>
  );
};

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
  'fixed-input': FixedInputNodeComponent,
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
          padding: 20, // More padding for better spacing
          includeHiddenNodes: false,
          minZoom: 1.2, // Zoom out more for better overview
          maxZoom: 10, // Higher maximum zoom
          duration: 800, // Smooth animation duration
        });
      }, 100);
    }
  }, [nodes, edges, reactFlowInstance]);

  return (
    <>
      <Controls />
      <Background />
    </>
  );
}

export function PureWorkflowView({ workflow, className }: WorkflowViewProps) {
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
          elementsSelectable={true}
          nodesConnectable={false}
          nodesDraggable={false}
          fitView
          fitViewOptions={{
            padding: 20,
            includeHiddenNodes: false,
            minZoom: 0.8,
            maxZoom: 2,
            duration: 800,
          }}
        >
          <WorkflowFlowComponent nodes={initialNodes} edges={initialEdges} />
        </ReactFlow>
      </div>
    </div>
  );
}

export default memo(PureWorkflowView, (prev, next) => {
  return prev.workflow !== next.workflow;
});
