import { WorkflowEngineError } from './errors';
import {
  type ConditionNode,
  type ConditionNodeExecutionResult,
  ConditionNodeExecutionResultSchema,
  type ConditionNodeInput,
  type ConverterNode,
  type ConverterNodeExecutionResult,
  ConverterNodeExecutionResultSchema,
  type CronjobTriggerNode,
  type FixedInput,
  type ToolNode,
  type Workflow,
} from './types';
import { Environment } from 'nunjucks';

// Union type for all actual node types that have a 'type' property
type WorkflowNode =
  | ToolNode
  | ConverterNode
  | CronjobTriggerNode
  | ConditionNode
  | FixedInput;

interface WorkflowEngineInterface {
  /**
   * Execute the workflow follow the order using BFS.
   * @throws `WorkflowEngineError` if the workflow failed to execute
   * @returns The output from the tail node
   */
  execute(workflow: Workflow, input?: any): Promise<any>;
}

interface ExecutionContext {
  nodeId: string;
  context?: Record<string, any>;
}

export interface ToolExecutionEngine {
  execute(tool: string, input: any): Promise<any>;
}

export interface JSCodeExecutionEngine {
  execute(input: any, code: string, context: any): unknown;
}

export class WorkflowEngine implements WorkflowEngineInterface {
  private executionQueue: ExecutionContext[] = [];
  private executedNodes: Set<string> = new Set();
  private nodeOutputs: Map<string, any> = new Map();
  private conditionalNodeParentTracker: Map<string, Set<string>> = new Map();
  private workflow!: Workflow; // Using definite assignment assertion since it's set in execute()
  private lastExecutedOutput: any = null; // Track the output from the last executed node

  private jsCodeExecutionEngine: JSCodeExecutionEngine;
  private toolExecutionEngine: ToolExecutionEngine;

  constructor(
    jsCodeExecutionEngine: JSCodeExecutionEngine,
    toolExecutionEngine: ToolExecutionEngine,
  ) {
    this.jsCodeExecutionEngine = jsCodeExecutionEngine;
    this.toolExecutionEngine = toolExecutionEngine;
  }

  async execute(
    workflow: Workflow,
    context: Record<string, any> = {},
  ): Promise<any> {
    try {
      this.reset();
      this.workflow = workflow;
      // Skip the trigger node and start execution from its child
      if (workflow.trigger.child) {
        this.executionQueue.push({
          nodeId: workflow.trigger.child.identifier,
          context: context,
        });
      } else {
        throw new WorkflowEngineError('Trigger node has no child to execute');
      }

      while (this.executionQueue.length > 0) {
        const context = this.executionQueue.shift();

        if (!context || this.executedNodes.has(context.nodeId)) {
          continue; // Skip already executed nodes
        }

        await this.executeNode(context, workflow);
      }

      // Return the output from the last executed node
      return this.lastExecutedOutput;
    } catch (error) {
      if (error instanceof WorkflowEngineError) {
        throw error;
      }
      throw new WorkflowEngineError(
        `Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private reset(): void {
    this.executionQueue = [];
    this.executedNodes.clear();
    this.nodeOutputs.clear();
    this.conditionalNodeParentTracker.clear();
    this.lastExecutedOutput = null;
  }

  private async executeNode(
    context: ExecutionContext,
    workflow: Workflow,
  ): Promise<void> {
    const node = this.findNodeById(context.nodeId, workflow);

    if (!node) {
      throw new WorkflowEngineError(
        `Node with identifier '${context.nodeId}' not found in workflow`,
      );
    }

    console.log(`Executing node: ${node.identifier} (type: ${node.type})`);

    // Check if this is a conditional node that needs to wait for all parents
    if (this.isConditionalNode(node)) {
      const shouldWait = this.shouldWaitForParents(node as ConditionNode);
      if (shouldWait) {
        // Re-queue this node for later execution
        this.executionQueue.push(context);
        return;
      }
    }

    let output: any;

    switch (node.type) {
      case 'cronjob-trigger':
        output = await this.executeTriggerNode(
          node as CronjobTriggerNode,
          context.context,
        );
        break;
      case 'tool':
        output = await this.executeToolNode(node as ToolNode, context.context);
        break;
      case 'condition':
        output = await this.executeConditionNode(
          node as ConditionNode,
          context.context,
        );
        break;
      case 'converter':
        output = await this.executeConverterNode(
          node as ConverterNode,
          context.context,
        );
        break;
      case 'fixed-input':
        output = await this.executeFixedInputNode(
          node as FixedInput,
          context.context || {},
        );
        break;
      default:
        throw new WorkflowEngineError(
          `Unknown node type: ${(node as any).type}`,
        );
    }

    // Mark node as executed and store output
    this.executedNodes.add(node.identifier);
    this.nodeOutputs.set(node.identifier, output);
    this.lastExecutedOutput = output; // Track the last executed node's output

    // Queue next nodes for execution
    this.queueNextNodes(node, output, workflow);
  }

  private findNodeById(
    nodeId: string,
    workflow: Workflow,
  ): WorkflowNode | null {
    // Start with trigger
    if (workflow.trigger.identifier === nodeId) {
      return workflow.trigger;
    }

    // Recursively search through all nodes starting from the trigger
    return this.searchNodeRecursively(nodeId, workflow.trigger);
  }

  private searchNodeRecursively(
    nodeId: string,
    node: WorkflowNode,
  ): WorkflowNode | null {
    // Check if this is the node we're looking for
    if (node.identifier === nodeId) {
      return node;
    }

    // Search in children based on node type
    if (this.isConditionalNode(node)) {
      const conditionNode = node as ConditionNode;
      for (const child of conditionNode.children) {
        // Check if child is a full node object (has 'type' property) or just a reference
        if ('type' in child) {
          const found = this.searchNodeRecursively(
            nodeId,
            child as WorkflowNode,
          );
          if (found) return found;
        }
      }
    } else if (this.hasRegularNodeStructure(node)) {
      const regularNode = node as ToolNode | ConverterNode | CronjobTriggerNode;
      if (regularNode.child) {
        // Check if child is a full node object (has 'type' property) or just a reference
        if ('type' in regularNode.child) {
          const found = this.searchNodeRecursively(
            nodeId,
            regularNode.child as WorkflowNode,
          );
          if (found) return found;
        }
      }
    }

    return null;
  }

  private isConditionalNode(node: WorkflowNode): boolean {
    return node.type === 'condition';
  }

  private isTriggerNode(node: WorkflowNode): boolean {
    return node.type === 'cronjob-trigger';
  }

  private shouldWaitForParents(conditionNode: ConditionNode): boolean {
    const nodeId = conditionNode.identifier;

    // Initialize parent tracker if not exists
    if (!this.conditionalNodeParentTracker.has(nodeId)) {
      this.conditionalNodeParentTracker.set(nodeId, new Set());
    }

    const executedParents = this.conditionalNodeParentTracker.get(nodeId);
    if (!executedParents) {
      throw new WorkflowEngineError(
        `Failed to get parent tracker for node '${nodeId}'`,
      );
    }

    // Find all parent nodes that reference this conditional node
    const parentNodes = this.findParentNodes(nodeId, this.workflow);
    const totalParents = parentNodes.length;

    // Check if all parents have executed
    for (const parent of parentNodes) {
      if (this.isTriggerNode(parent)) {
        executedParents.add(parent.identifier);
        continue; // Trigger nodes are always executed
      }
      if (this.executedNodes.has(parent.identifier)) {
        executedParents.add(parent.identifier);
      }
    }

    return executedParents.size < totalParents;
  }

  private async executeFixedInputNode(
    node: FixedInput,
    context: Record<string, any>,
  ): Promise<any> {
    console.log(`Fixed input node executed: ${node.identifier}`);

    const env = new Environment();
    // recursively render each value using input and context
    // If the node has no input but receives context from previous node, use context as input
    const renderContext = {
      input: node.input || context,
      context: context,
    };

    /**
     * Recursively renders all string templates in an object, array, or primitive value
     * @param value - The value to render (can be object, array, string, or primitive)
     * @returns The rendered value with all templates processed
     */
    const renderRecursively = (value: any): any => {
      if (typeof value === 'string') {
        // Render string templates using nunjucks
        try {
          return env.renderString(value, renderContext);
        } catch (error) {
          console.warn(`Failed to render template "${value}":`, error);
          return value; // Return original value if rendering fails
        }
      } else if (Array.isArray(value)) {
        // Recursively render each item in the array
        return value.map((item) => renderRecursively(item));
      } else if (value !== null && typeof value === 'object') {
        // Recursively render each property in the object
        const renderedObject: Record<string, any> = {};
        for (const [key, val] of Object.entries(value)) {
          renderedObject[key] = renderRecursively(val);
        }
        return renderedObject;
      } else {
        // Return primitive values (number, boolean, null, undefined) as-is
        return value;
      }
    };

    const renderedOutput = renderRecursively(node.output);

    return renderedOutput;
  }

  private async executeTriggerNode(
    node: CronjobTriggerNode,
    input?: any,
  ): Promise<any> {
    console.log(
      `Trigger node executed: ${node.identifier} with cron: ${node.cron}`,
    );
    // Trigger nodes can pass through input or provide initial data
    return (
      input || { trigger: 'executed', timestamp: new Date().toISOString() }
    );
  }

  private async executeToolNode(node: ToolNode, input?: any): Promise<any> {
    console.log(
      `Tool node executed: ${node.identifier} using tool: ${node.toolIdentifier}`,
    );

    try {
      // Use the actual tool execution engine
      const result = await this.toolExecutionEngine.execute(
        node.toolIdentifier,
        input,
      );
      return result;
    } catch (error) {
      throw new WorkflowEngineError(
        `Tool node '${node.identifier}' execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async executeConditionNode(
    node: ConditionNode,
    input?: any,
  ): Promise<ConditionNodeExecutionResult> {
    console.log(`Condition node executed: ${node.identifier}`);

    try {
      // Collect inputs from all parent nodes
      let parentInput: ConditionNodeInput | null = null;

      const parentNodes = this.findParentNodes(
        node.identifier,
        this.workflow,
      ).filter((parent) => !this.isTriggerNode(parent));

      // condition node can only have one parent node
      if (parentNodes.length > 0) {
        const firstParent = parentNodes[0];
        const parentOutput = this.nodeOutputs.get(firstParent.identifier);
        if (parentOutput !== undefined) {
          parentInput = {
            input: parentOutput,
            nodeId: firstParent.identifier,
          };
        }
      }

      const result = this.jsCodeExecutionEngine.execute(
        parentInput,
        node.code,
        {
          nodeId: node.identifier,
        },
      );

      return ConditionNodeExecutionResultSchema.parse(result);
    } catch (error) {
      throw new WorkflowEngineError(
        `Condition node '${node.identifier}' execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async executeConverterNode(
    node: ConverterNode,
    input?: any,
  ): Promise<ConverterNodeExecutionResult> {
    console.log(
      `Converter node executed: ${node.identifier} using converter: ${node.code}`,
    );

    try {
      // Execute the JavaScript code for conversion
      const result = this.jsCodeExecutionEngine.execute(input, node.code, {
        input,
        code: node.code,
        nodeId: node.identifier,
      });

      return ConverterNodeExecutionResultSchema.parse(result);
    } catch (error) {
      throw new WorkflowEngineError(
        `Converter node '${node.identifier}' execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private queueNextNodes(
    node: WorkflowNode,
    output: any,
    workflow: Workflow,
  ): void {
    if (this.hasRegularNodeStructure(node)) {
      // Regular nodes (Tool, Converter, Trigger) have single child
      const regularNode = node as ToolNode | ConverterNode | CronjobTriggerNode;
      if (regularNode.child) {
        this.executionQueue.push({
          nodeId: regularNode.child.identifier,
          context: output,
        });
      }
    } else if (this.isConditionalNode(node)) {
      // The condition result should determine which child to execute
      // If result is null, exit the workflow
      if (output === null) {
        console.log('Workflow terminated by condition node returning null');
        return;
      }

      // Result is a string - execute the node with that identifier
      this.executionQueue.push({
        nodeId: output,
        context: undefined, // No specific input for string result
      });
    }
  }

  private hasRegularNodeStructure(node: WorkflowNode): boolean {
    return 'child' in node && !('children' in node);
  }

  /**
   * Find all parent nodes that reference the given node ID
   * This implements a DFS search through the workflow to find parent-child relationships
   */
  private findParentNodes(nodeId: string, workflow: Workflow): WorkflowNode[] {
    const parents: WorkflowNode[] = [];

    const searchForParents = (currentNode: WorkflowNode): void => {
      // Check if current node is a parent of the target node
      if (this.hasRegularNodeStructure(currentNode)) {
        const regularNode = currentNode as
          | ToolNode
          | ConverterNode
          | CronjobTriggerNode;
        if (regularNode.child && regularNode.child.identifier === nodeId) {
          parents.push(currentNode);
        }
        // Continue searching in the child
        if (regularNode.child && 'type' in regularNode.child) {
          searchForParents(regularNode.child as WorkflowNode);
        }
      } else if (this.isConditionalNode(currentNode)) {
        const conditionNode = currentNode as ConditionNode;
        // Check if any children match the target node
        for (const child of conditionNode.children) {
          if (child.identifier === nodeId) {
            parents.push(currentNode);
          }
          // Continue searching in children
          if ('type' in child) {
            searchForParents(child as WorkflowNode);
          }
        }
      }
    };

    // Start search from the trigger node
    searchForParents(workflow.trigger);

    return parents;
  }
}
