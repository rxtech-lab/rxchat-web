'use client';

import { cn } from '@/lib/utils';
import type { Edge, Node } from '@xyflow/react';
import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  Position,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Clock, Code, GitBranch, Wrench, Zap } from 'lucide-react';
import { useMemo } from 'react';
import type { CronjobTriggerNode, Workflow } from './types';

// Custom node components
const TriggerNodeComponent = ({ data }: { data: any }) => (
  <div
    className={cn(
      'px-4 py-3 rounded-lg border-2 min-w-[200px]',
      'bg-green-50 border-green-300 shadow-md',
    )}
  >
    <div className="flex items-center gap-2 mb-1">
      <Clock className="size-4 text-green-600" />
      <span className="font-semibold text-green-800">Cronjob Trigger</span>
    </div>
    <div className="text-sm text-green-700">
      <div>
        Schedule: <code className="bg-green-100 px-1 rounded">{data.cron}</code>
      </div>
      <div className="text-xs text-green-600 mt-1">ID: {data.identifier}</div>
    </div>
  </div>
);

const ToolNodeComponent = ({ data }: { data: any }) => (
  <div
    className={cn(
      'px-4 py-3 rounded-lg border-2 min-w-[200px]',
      'bg-blue-50 border-blue-300 shadow-md',
    )}
  >
    <div className="flex items-center gap-2 mb-1">
      <Wrench className="size-4 text-blue-600" />
      <span className="font-semibold text-blue-800">Tool</span>
    </div>
    <div className="text-sm text-blue-700">
      <div>
        Tool:{' '}
        <span className="font-mono bg-blue-100 px-1 rounded">{data.tool}</span>
      </div>
      <div className="text-xs text-blue-600 mt-1">ID: {data.identifier}</div>
    </div>
  </div>
);

const ConditionNodeComponent = ({ data }: { data: any }) => (
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
        Parents: {data.parents?.length || 0} | Children:{' '}
        {data.children?.length || 0}
      </div>
      <div className="text-xs text-yellow-600">ID: {data.identifier}</div>
    </div>
  </div>
);

const ConverterNodeComponent = ({ data }: { data: any }) => (
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

const DefaultNodeComponent = ({ data }: { data: any }) => (
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

export function WorkflowView({ workflow, className }: WorkflowViewProps) {
  // Build nodes and edges from workflow structure
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodeMap = new Map<string, any>();

    // Helper function to collect all nodes recursively
    const collectNodes = (node: any, visited = new Set<string>()): void => {
      if (!node || visited.has(node.identifier)) return;
      visited.add(node.identifier);
      nodeMap.set(node.identifier, node);

      // Handle child (singular)
      if (node.child) {
        collectNodes(node.child, visited);
      }

      // Handle children (array)
      if (node.children) {
        node.children.forEach((child: any) => collectNodes(child, visited));
      }
    };

    // Start collecting from trigger
    collectNodes(workflow.trigger);

    // Convert to ReactFlow nodes with vertical layout
    let yPosition = 0;
    const xPosition = 200; // Center position
    const ySpacing = 120; // Vertical spacing between nodes

    Array.from(nodeMap.values()).forEach((node, index) => {
      const flowNode: Node = {
        id: node.identifier,
        type: node.type || 'default',
        position: { x: xPosition, y: yPosition },
        data: node,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      };

      nodes.push(flowNode);
      yPosition += ySpacing;
    });

    // Build edges
    Array.from(nodeMap.values()).forEach((node) => {
      // Handle single child connection
      if (node.child) {
        edges.push({
          id: `${node.identifier}-${node.child.identifier}`,
          source: node.identifier,
          target: node.child.identifier,
          type: 'default',
          animated: true,
        });
      }

      // Handle multiple children connections
      if (node.children) {
        node.children.forEach((child: any) => {
          edges.push({
            id: `${node.identifier}-${child.identifier}`,
            source: node.identifier,
            target: child.identifier,
            type: 'default',
            animated: true,
          });
        });
      }
    });

    return { nodes, edges };
  }, [workflow]);

  return (
    <div className={cn('w-full h-full bg-gray-50', className)}>
      <div className="h-full">
        <ReactFlow
          nodes={initialNodes}
          edges={initialEdges}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{
            padding: 0.2,
            minZoom: 0.1,
            maxZoom: 1.5,
          }}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          elementsSelectable={false}
          nodesConnectable={false}
          nodesDraggable={false}
        >
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
        </ReactFlow>
      </div>

      {/* Workflow info header */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md p-3 border">
        <h3 className="font-semibold text-gray-800 mb-1">{workflow.title}</h3>
        <div className="text-sm text-gray-600">
          Trigger: {workflow.trigger.type}
          {workflow.trigger.type === 'cronjob-trigger' && (
            <span className="ml-2 font-mono bg-gray-100 px-1 rounded text-xs">
              {(workflow.trigger as CronjobTriggerNode).cron}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkflowView;
