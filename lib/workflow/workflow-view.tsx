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
import cronstrue from 'cronstrue';
import {
  Clock,
  Code,
  Database,
  Eye,
  GitBranch,
  Square,
  Wrench,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  BaseNode,
  BooleanNode,
  ConditionNode,
  ConverterNode,
  CronjobTriggerNode,
  FixedInput,
  SkipNode,
  ToolNode,
  TriggerNode,
  UpsertStateNode,
  Workflow,
} from './types';

// Union type for all possible workflow nodes
type WorkflowNode =
  | ToolNode
  | BooleanNode
  | ConditionNode
  | ConverterNode
  | TriggerNode
  | CronjobTriggerNode
  | FixedInput
  | SkipNode
  | UpsertStateNode;

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

const BooleanNodeComponent = ({ data }: { data: BooleanNode }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 min-w-[200px]',
        'bg-indigo-50 border-indigo-300 shadow-md',
      )}
    >
      <Handle type="target" position={Position.Top} />
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: '25%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: '75%' }}
      />
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="size-4 text-indigo-600" />
        <span className="font-semibold text-indigo-800">Boolean</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto p-1 size-6 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 z-10 relative"
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
              <DialogTitle>Boolean Code - {data.identifier}</DialogTitle>
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
                style={{ height: '400px' }}
              >
                <Editor
                  height="400px"
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
      <div className="text-sm text-indigo-700">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-green-600">TRUE</span>
          <span className="text-xs font-medium text-red-600">FALSE</span>
        </div>
        <div>
          Code:{' '}
          <span className="font-mono bg-indigo-100 px-1 rounded text-xs">
            {data.code.length > 15
              ? `${data.code.substring(0, 15)}...`
              : data.code}
          </span>
        </div>
        <div className="text-xs text-indigo-600 mt-1">
          ID: {data.identifier}
        </div>
      </div>
    </div>
  );
};

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

const SkipNodeComponent = ({ data }: { data: SkipNode }) => (
  <div
    className={cn(
      'px-4 py-3 rounded-lg border-2 min-w-[200px]',
      'bg-red-50 border-red-300 shadow-md',
    )}
  >
    <Handle type="target" position={Position.Top} />
    <div className="flex items-center gap-2 mb-1">
      <Square className="size-4 text-red-600" />
      <span className="font-semibold text-red-800">Skip</span>
    </div>
    <div className="text-sm text-red-700">
      <div className="text-xs text-red-600 mb-1">
        Terminates workflow execution
      </div>
      <div className="text-xs text-red-600">ID: {data.identifier}</div>
    </div>
  </div>
);

const UpsertStateNodeComponent = ({ data }: { data: UpsertStateNode }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 min-w-[200px]',
        'bg-teal-50 border-teal-300 shadow-md',
      )}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <div className="flex items-center gap-2 mb-1">
        <Database className="size-4 text-teal-600" />
        <span className="font-semibold text-teal-800">Upsert State</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto p-1 size-6 text-teal-600 hover:text-teal-800 hover:bg-teal-100 z-10 relative"
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
              <DialogTitle>Upsert State Value - {data.identifier}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <div className="text-sm text-gray-600">
                Key:{' '}
                <span className="font-mono bg-gray-100 px-1 rounded">
                  {data.key}
                </span>
              </div>
              <div
                className="border rounded-lg overflow-hidden"
                style={{ height: '400px' }}
              >
                <Editor
                  height="400px"
                  language="json"
                  theme="vs-light"
                  value={JSON.stringify(data.value, null, 2)}
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
      <div className="text-sm text-teal-700">
        <div>
          Key:{' '}
          <span className="font-mono bg-teal-100 px-1 rounded text-xs">
            {data.key}
          </span>
        </div>
        <div>
          Value:{' '}
          <span className="font-mono bg-teal-100 px-1 rounded text-xs">
            {typeof data.value === 'string' && data.value.length > 15
              ? `${data.value.substring(0, 15)}...`
              : typeof data.value === 'object'
                ? 'Object'
                : String(data.value)}
          </span>
        </div>
        <div className="text-xs text-teal-600 mt-1">ID: {data.identifier}</div>
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
  boolean: BooleanNodeComponent,
  condition: ConditionNodeComponent,
  converter: ConverterNodeComponent,
  'fixed-input': FixedInputNodeComponent,
  skip: SkipNodeComponent,
  'upsert-state': UpsertStateNodeComponent,
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
          padding: 40, // Better padding for centered view
          includeHiddenNodes: false,
          minZoom: 1, // Maintain readable zoom level
          maxZoom: 1.5, // Prevent over-zooming
          duration: 600, // Smooth animation duration
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

export default function WorkflowView({
  workflow,
  className,
}: WorkflowViewProps) {
  // Build nodes and edges from workflow structure
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Helper function to calculate node height based on content
    const getNodeHeight = (node: WorkflowNode): number => {
      const baseHeight = 80; // Base node height
      const lineHeight = 20; // Height per line of content

      switch (node.type) {
        case 'cronjob-trigger':
        case 'trigger':
          // Base + schedule info + ID
          return (
            baseHeight +
            (node.type === 'cronjob-trigger' &&
            (node as CronjobTriggerNode).cron
              ? lineHeight * 2
              : lineHeight)
          );

        case 'tool':
          // Base + tool info + ID
          return baseHeight + lineHeight;

        case 'boolean':
          // Base + true/false labels + code preview + ID
          return baseHeight + lineHeight * 2;

        case 'condition':
          // Base + runtime + children count + ID
          return baseHeight + lineHeight * 2;

        case 'converter':
          // Base + code preview + runtime + ID
          return baseHeight + lineHeight * 2;

        case 'fixed-input':
          // Base + output info + jinja note + ID
          return baseHeight + lineHeight * 2;

        case 'skip':
          // Base + termination note + ID
          return baseHeight + lineHeight;

        case 'upsert-state':
          // Base + key + value preview + ID
          return baseHeight + lineHeight * 2;

        default:
          return baseHeight;
      }
    };

    // Helper function to recursively shift all descendants of a node
    const shiftNodeAndDescendants = (
      nodeId: string,
      xShift: number,
      visited = new Set<string>(),
    ): void => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const nodeIndex = nodes.findIndex((n) => n.id === nodeId);
      if (nodeIndex !== -1) {
        nodes[nodeIndex].position.x += xShift;

        // Find the node data to get its children
        const nodeData = nodes[nodeIndex].data;

        // Recursively shift children based on node type
        if (nodeData.type === 'boolean') {
          const booleanNode = nodeData as BooleanNode;
          if (booleanNode.trueChild) {
            shiftNodeAndDescendants(
              booleanNode.trueChild.identifier,
              xShift,
              visited,
            );
          }
          if (booleanNode.falseChild) {
            shiftNodeAndDescendants(
              booleanNode.falseChild.identifier,
              xShift,
              visited,
            );
          }
        } else if ('child' in nodeData && nodeData.child) {
          const childNode = nodeData.child as WorkflowNode;
          if (childNode?.identifier) {
            shiftNodeAndDescendants(childNode.identifier, xShift, visited);
          }
        } else if ('children' in nodeData && Array.isArray(nodeData.children)) {
          nodeData.children.forEach((child) => {
            if (
              child &&
              typeof child === 'object' &&
              'identifier' in child &&
              child.identifier
            ) {
              shiftNodeAndDescendants(child.identifier, xShift, visited);
            }
          });
        }
      }
    };

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

      const xPosition = 0; // Center position - ReactFlow will handle centering
      const nodeHeight = getNodeHeight(node);
      const minSpacing = 40; // Minimum spacing between nodes

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
      let nextYPosition = yPosition + nodeHeight + minSpacing;

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
            type: 'straight',
            animated: true,
          });
          nextYPosition = processNode(
            child as WorkflowNode,
            nextYPosition,
            visited,
          );
        }
      }

      // Handle boolean node with trueChild and falseChild
      if (
        node.type === 'boolean' &&
        'trueChild' in node &&
        'falseChild' in node
      ) {
        const booleanNode = node as BooleanNode;
        let maxChildYPosition = nextYPosition;

        // Handle true child (left side)
        if (booleanNode.trueChild) {
          edges.push({
            id: `${node.identifier}-true-${booleanNode.trueChild.identifier}`,
            source: node.identifier,
            sourceHandle: 'true',
            target: booleanNode.trueChild.identifier,
            type: 'straight',
            animated: true,
            label: 'TRUE',
            labelStyle: { fill: '#059669', fontWeight: 600 },
            labelBgStyle: { fill: '#ecfdf5' },
          });

          const trueChildYPosition = processNode(
            booleanNode.trueChild as WorkflowNode,
            nextYPosition,
            visited,
          );

          // Position true child and all its descendants to the left
          shiftNodeAndDescendants(booleanNode.trueChild.identifier, -150);

          maxChildYPosition = Math.max(maxChildYPosition, trueChildYPosition);
        }

        // Handle false child (right side)
        if (booleanNode.falseChild) {
          edges.push({
            id: `${node.identifier}-false-${booleanNode.falseChild.identifier}`,
            source: node.identifier,
            sourceHandle: 'false',
            target: booleanNode.falseChild.identifier,
            type: 'straight',
            animated: true,
            label: 'FALSE',
            labelStyle: { fill: '#dc2626', fontWeight: 600 },
            labelBgStyle: { fill: '#fef2f2' },
          });

          const falseChildYPosition = processNode(
            booleanNode.falseChild as WorkflowNode,
            nextYPosition,
            visited,
          );

          // Position false child and all its descendants to the right
          shiftNodeAndDescendants(booleanNode.falseChild.identifier, 150);

          maxChildYPosition = Math.max(maxChildYPosition, falseChildYPosition);
        }

        nextYPosition = maxChildYPosition;
      }
      // Handle children (array) - for ConditionNode
      else if ('children' in node && Array.isArray(node.children)) {
        let maxChildYPosition = nextYPosition;

        node.children.forEach((child, index) => {
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
              type: 'straight',
              animated: true,
            });

            // For multiple children, position them side by side and continue the longest branch
            const childXOffset = (index - (node.children.length - 1) / 2) * 250;
            const childYPosition = nextYPosition;

            // Update child position to be side by side
            const processedChildYPosition = processNode(
              child as WorkflowNode,
              childYPosition,
              visited,
            );

            // Update the x-position for side-by-side layout
            const childNodeIndex = nodes.findIndex(
              (n) => n.id === (child as WorkflowNode).identifier,
            );
            if (childNodeIndex !== -1) {
              nodes[childNodeIndex].position.x = childXOffset;
            }

            maxChildYPosition = Math.max(
              maxChildYPosition,
              processedChildYPosition,
            );
          }
        });

        nextYPosition = maxChildYPosition;
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
            padding: 40,
            includeHiddenNodes: false,
            minZoom: 1,
            maxZoom: 1.5,
            duration: 600,
          }}
        >
          <WorkflowFlowComponent nodes={initialNodes} edges={initialEdges} />
        </ReactFlow>
      </div>
    </div>
  );
}
