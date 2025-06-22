import { WorkflowEngineError, WorkflowReferenceError } from './errors';
import type { StateClient } from './state';
import {
  type BooleanNode,
  type BooleanNodeExecutionResult,
  BooleanNodeExecutionResultSchema,
  type ConditionNode,
  type ConditionNodeExecutionResult,
  ConditionNodeExecutionResultSchema,
  type ConditionNodeInput,
  type ConverterNode,
  type ConverterNodeExecutionResult,
  ConverterNodeExecutionResultSchema,
  type CronjobTriggerNode,
  type ExtraContext,
  type FixedInput,
  type SkipNode,
  type ToolNode,
  type UpsertStateNode,
  type Workflow,
} from './types';
import { Environment } from 'nunjucks';

// Union type for all actual node types that have a 'type' property
type WorkflowNode =
  | ToolNode
  | ConverterNode
  | CronjobTriggerNode
  | ConditionNode
  | BooleanNode
  | FixedInput
  | SkipNode
  | UpsertStateNode;

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
  execute(
    tool: string,
    input: any,
    inputSchema: Record<string, any>,
    outputSchema: Record<string, any>,
  ): Promise<any>;
}

export interface JSCodeExecutionEngine {
  execute(input: ExtraContext, code: string, context: any): unknown;
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
  private stateClient: StateClient;

  private workflowContext: Record<string, any> = {};

  constructor(
    jsCodeExecutionEngine: JSCodeExecutionEngine,
    toolExecutionEngine: ToolExecutionEngine,
    stateClient: StateClient,
  ) {
    this.jsCodeExecutionEngine = jsCodeExecutionEngine;
    this.toolExecutionEngine = toolExecutionEngine;
    this.stateClient = stateClient;
  }

  async execute(
    workflow: Workflow,
    context: Record<string, any> = {},
  ): Promise<any> {
    this.workflowContext = context;
    try {
      this.reset();
      this.workflow = workflow;
      // Skip the trigger node and start execution from its child
      if (workflow.trigger.child) {
        this.executionQueue.push({
          nodeId: workflow.trigger.child.identifier,
          context: {},
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
      case 'boolean':
        output = await this.executeBooleanNode(
          node as BooleanNode,
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
      case 'upsert-state':
        output = await this.executeUpsertStateNode(
          node as UpsertStateNode,
          context.context,
        );
        break;
      case 'skip':
        output = await this.executeSkipNode(node as SkipNode, context.context);
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
    if (node.type === 'boolean') {
      const booleanNode = node as BooleanNode;
      // Search in trueChild
      if (booleanNode.trueChild && 'type' in booleanNode.trueChild) {
        const found = this.searchNodeRecursively(
          nodeId,
          booleanNode.trueChild as WorkflowNode,
        );
        if (found) return found;
      }
      // Search in falseChild
      if (booleanNode.falseChild && 'type' in booleanNode.falseChild) {
        const found = this.searchNodeRecursively(
          nodeId,
          booleanNode.falseChild as WorkflowNode,
        );
        if (found) return found;
      }
    } else if (this.isConditionalNode(node)) {
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
      const regularNode = node as
        | ToolNode
        | ConverterNode
        | CronjobTriggerNode
        | FixedInput
        | SkipNode
        | UpsertStateNode;
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
    return node.type === 'condition' || node.type === 'boolean';
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

    const env = new Environment(undefined, { throwOnUndefined: true });
    // Use context (from parent node's output) as input, and workflow context as context
    // If context is empty (first node after trigger), use workflow context as input too
    const inputContext =
      Object.keys(context).length === 0 ? this.workflowContext : context;
    const renderContext = {
      input: inputContext,
      context: this.workflowContext,
      state: await this.getStates(),
    };

    /**
     * Recursively renders all string templates in an object, array, or primitive value
     * @param value - The value to render (can be object, array, string, or primitive)
     * @returns The rendered value with all templates processed
     * @throws WorkflowReferenceError if a template variable is not found
     */
    const renderRecursively = (value: any): any => {
      if (typeof value === 'string') {
        // Render string templates using nunjucks
        try {
          return env.renderString(value, renderContext);
        } catch (error) {
          // Check if the error is about a missing variable
          if (error instanceof Error) {
            // Extract all variable references from the template string
            const matches = value.match(/{{([^}]+)}}/g);
            if (matches) {
              for (const match of matches) {
                const reference = match.replace(/[{}]/g, '').trim();
                const [field, ...path] = reference.split('.');
                if (field === 'input' || field === 'context') {
                  // Check if the variable exists in the context
                  const contextValue =
                    field === 'input' ? inputContext : this.workflowContext;
                  if (
                    path.length > 0 &&
                    (!(path[0] in contextValue) ||
                      contextValue[path[0]] == null)
                  ) {
                    throw new WorkflowReferenceError(
                      field as 'input' | 'context',
                      path.join('.'),
                      node.identifier,
                    );
                  }
                }
              }
            }
          }
          throw error; // Re-throw other errors
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

    try {
      const renderedOutput = renderRecursively(node.output);
      return renderedOutput;
    } catch (error) {
      console.dir(inputContext);
      if (error instanceof WorkflowReferenceError) {
        throw error;
      }
      throw new WorkflowEngineError(
        `Fixed input node '${node.identifier}' execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
        node.inputSchema,
        node.outputSchema,
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
        {
          input: parentInput?.input,
          state: await this.getStates(),
        },
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

  private async executeBooleanNode(
    node: BooleanNode,
    input?: any,
  ): Promise<BooleanNodeExecutionResult> {
    console.log(`Boolean node executed: ${node.identifier}`);

    try {
      // Collect inputs from all parent nodes (similar to condition node)
      let parentInput: ConditionNodeInput | null = null;

      const parentNodes = this.findParentNodes(
        node.identifier,
        this.workflow,
      ).filter((parent) => !this.isTriggerNode(parent));

      // boolean node can only have one parent node
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

      const result = await this.jsCodeExecutionEngine.execute(
        {
          input: parentInput?.input,
          state: await this.getStates(),
        },
        node.code,
        {
          nodeId: node.identifier,
        },
      );

      return BooleanNodeExecutionResultSchema.parse(result);
    } catch (error) {
      throw new WorkflowEngineError(
        `Boolean node '${node.identifier}' execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async executeConverterNode(
    node: ConverterNode,
    input?: any,
    context?: Record<string, any>,
  ): Promise<ConverterNodeExecutionResult> {
    console.log(
      `Converter node executed: ${node.identifier} using converter: ${node.code}`,
    );

    try {
      // Execute the JavaScript code for conversion
      const result = await this.jsCodeExecutionEngine.execute(
        {
          input,
          state: await this.getStates(),
        },
        node.code,
        {
          input,
          code: node.code,
          nodeId: node.identifier,
        },
      );

      return ConverterNodeExecutionResultSchema.parse(result);
    } catch (error) {
      throw new WorkflowEngineError(
        `Converter node '${node.identifier}' execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async executeUpsertStateNode(
    node: UpsertStateNode,
    input?: any,
  ): Promise<any> {
    console.log(
      `Upsert state node executed: ${node.identifier} with key: ${node.key}, value: ${JSON.stringify(node.value)}`,
    );

    try {
      // Store the value in state using the key
      await this.stateClient.setState(node.key, node.value);

      // Return the value that was stored
      return node.value;
    } catch (error) {
      throw new WorkflowEngineError(
        `Upsert state node '${node.identifier}' execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async executeSkipNode(node: SkipNode, input?: any): Promise<any> {
    console.log(
      `Skip node executed: ${node.identifier} - terminating workflow execution`,
    );

    // Skip node terminates workflow execution and returns whatever input it receives
    // This will be the final output of the workflow
    return input;
  }

  private queueNextNodes(
    node: WorkflowNode,
    output: any,
    workflow: Workflow,
  ): void {
    // Skip nodes terminate workflow execution, so don't queue any children
    if (node.type === 'skip') {
      console.log(
        'Skip node terminates workflow - no further nodes will be executed',
      );
      return;
    }

    if (this.hasRegularNodeStructure(node)) {
      // Regular nodes (Tool, Converter, Trigger, FixedInput, Skip, State, UpsertState) have single child
      const regularNode = node as
        | ToolNode
        | ConverterNode
        | CronjobTriggerNode
        | FixedInput
        | SkipNode
        | UpsertStateNode;
      if (regularNode.child) {
        this.executionQueue.push({
          nodeId: regularNode.child.identifier,
          context: output,
        });
      }
    } else if (node.type === 'boolean') {
      // Boolean node execution: choose trueChild or falseChild based on boolean result
      const booleanNode = node as BooleanNode;
      const booleanResult = output as boolean;

      const nextNode = booleanResult
        ? booleanNode.trueChild
        : booleanNode.falseChild;

      if (nextNode) {
        this.executionQueue.push({
          nodeId: nextNode.identifier,
          context: undefined, // Boolean nodes don't pass specific context
        });
      } else {
        console.log(
          `Boolean node terminated workflow: no ${booleanResult ? 'true' : 'false'} child defined`,
        );
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
          | CronjobTriggerNode
          | FixedInput
          | SkipNode
          | UpsertStateNode;
        if (regularNode.child && regularNode.child.identifier === nodeId) {
          parents.push(currentNode);
        }
        // Continue searching in the child
        if (regularNode.child && 'type' in regularNode.child) {
          searchForParents(regularNode.child as WorkflowNode);
        }
      } else if (currentNode.type === 'boolean') {
        const booleanNode = currentNode as BooleanNode;
        // Check if trueChild matches the target node
        if (
          booleanNode.trueChild &&
          booleanNode.trueChild.identifier === nodeId
        ) {
          parents.push(currentNode);
        }
        // Check if falseChild matches the target node
        if (
          booleanNode.falseChild &&
          booleanNode.falseChild.identifier === nodeId
        ) {
          parents.push(currentNode);
        }
        // Continue searching in children
        if (booleanNode.trueChild && 'type' in booleanNode.trueChild) {
          searchForParents(booleanNode.trueChild as WorkflowNode);
        }
        if (booleanNode.falseChild && 'type' in booleanNode.falseChild) {
          searchForParents(booleanNode.falseChild as WorkflowNode);
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

  private async getStates(): Promise<Record<string, any>> {
    return this.stateClient.getAllState();
  }
}
