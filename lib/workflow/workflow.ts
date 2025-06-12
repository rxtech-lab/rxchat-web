import { tool } from 'ai';
import { v4 } from 'uuid';
import { z } from 'zod';
import { compileCode } from '../agent/runtime/runner-environment';
import { createMcpRouter } from '../router';
import type { McpRouter } from '../router/mcpRouter';
import {
  WorkflowInputOutputMismatchError,
  WorkflowToolMissingError,
} from './errors';
import type {
  BaseNode,
  ConditionNode,
  ConverterNode,
  CronjobTriggerNode,
  FixedInput,
  RegularNode,
  ToolNode,
  Workflow as WorkflowType,
} from './types';
import { WorkflowSchema } from './types';

export interface WorkflowInterface {
  // Add a child node to the workflow as child of the node with the identifier.
  addChild(identifier: string | undefined, child: RegularNode): void;
  // Add a child node to the workflow after the node with the identifier.
  // If the node with the identifier has a child, then the new child will be added between the nodes.
  // If the node with the identifier has no child, then the new child will be added as child of the node with the identifier.
  // If the node has children, error will be thrown.
  addAfter(identifier: string, child: RegularNode): void;
  // Remove a existing child node from the workflow. Throw an error if the node is not found.
  removeChild(identifier: string): void;
  // Modify a existing child node from the workflow. Throw an error if the node is not found.
  modifyChild(identifier: string, child: RegularNode): void;
  // Check if the workflow is valid using zod
  compile(): Promise<WorkflowType>;
}

export const addNodeTool = (workflow: Workflow) =>
  tool({
    description: 'Add a new tool node to the workflow',
    parameters: z.object({
      id: z
        .string()
        .nullable()
        .describe(
          'The identifier of the node this new node will be added after. If null or empty, the node will be added directly after the trigger node (at the root level). ' +
            "This is the node's unique ID in the workflow and is different from the toolIdentifier, which references a specific tool in the registry.",
        ),
      toolIdentifier: z.string().describe("The tool's unique identifier"),
    }),
    execute: async ({ id, toolIdentifier }) => {
      try {
        const toolInfo = await workflow.mcpRouter.getToolInfo(toolIdentifier);
        const node: ToolNode = {
          identifier: v4(),
          type: 'tool',
          toolIdentifier,
          child: null,
          description: toolInfo.description,
          inputSchema: toolInfo.inputSchema,
          outputSchema: toolInfo.outputSchema,
        };
        if (id === null || (typeof id === 'string' && id.trim() === '')) {
          workflow.addAfter(undefined, node);
        } else {
          workflow.addAfter(id, node);
        }

        return `Added tool node with identifier ${toolIdentifier} as child of ${id ?? 'root'}`;
      } catch (error) {
        console.log(error);
        return {
          error: error,
        };
      }
    },
  });

export const addConditionTool = (workflow: Workflow) =>
  tool({
    description: 'Add a new condition node to the workflow',
    parameters: z.object({
      toolIdentifier: z
        .string()
        .nullable()
        .describe(
          `The identifier for the condition node to be added as child of the node with the identifier. Empty if it added as root.
           Note: this node contains multiple children, and this tool will determine which child to use.
          `,
        ),
      code: z
        .string()
        .describe(
          `The code for the condition. Should be in the format export async function handle(input: Record<string, any>): Promise<string>. The return is the next tool identifier to use`,
        ),
    }),
    execute: async ({ toolIdentifier, code }) => {
      const node: ConditionNode = {
        identifier: v4(),
        type: 'condition',
        code: code,
        runtime: 'js',
        children: [],
      };
      if (toolIdentifier) {
        workflow.addChild(toolIdentifier, node);
      } else {
        workflow.addChild(undefined, node);
      }
      return `Added condition node with identifier ${node.identifier}`;
    },
  });

export const addConverterTool = (workflow: Workflow) =>
  tool({
    description: 'Add a new converter node to the workflow',
    parameters: z.object({
      toolIdentifier: z
        .string()
        .describe(
          "The tool's unique identifier that this node will be added after. This is the UUID not the tool identifier.",
        ),
      code: z
        .string()
        .describe(`The code for the converter. Written in Typescript and follow the following format:
          async function handle(input: any): Promise<any> {
            return input;
          }

          The input is the output of the tool with the identifier 'toolIdentifier'.
          The output should follow the targeted output schema.
          `),
    }),
    execute: async ({ toolIdentifier, code }) => {
      try {
        await compileCode(code, 'typescript');
      } catch (error) {
        return {
          error: error,
        };
      }
      const node: ConverterNode = {
        identifier: v4(),
        type: 'converter',
        code: code,
        child: null,
        runtime: 'js',
      };
      workflow.addAfter(toolIdentifier, node);
      return `Added converter node with identifier ${node.identifier}`;
    },
  });

export const removeNodeTool = (workflow: Workflow) =>
  tool({
    description: 'Remove a node from the workflow',
    parameters: z.object({
      identifier: z.string(),
    }),
    execute: async ({ identifier }) => {
      workflow.removeChild(identifier);
      return `Removed node with identifier ${identifier}`;
    },
  });

export const modifyToolNode = (workflow: Workflow) =>
  tool({
    description:
      'Modify a tool node in the workflow. This function cannot modify any other node type.',
    parameters: z.object({
      id: z.string().describe('The id of the node to modify'),
      node: z.object({
        toolIdentifier: z.string().describe("The tool's unique identifier"),
      }),
    }),
    execute: async ({ id, node }) => {
      // Get the current node to preserve its existing child relationship
      const currentNode = workflow.findNode(id);
      const existingChild =
        currentNode && 'child' in currentNode ? currentNode.child : null;

      workflow.modifyChild(id, {
        identifier: id,
        type: 'tool',
        toolIdentifier: node.toolIdentifier,
        child: existingChild,
      } as ToolNode);

      return `Modified tool node with identifier ${id} to ${node.toolIdentifier}`;
    },
  });

export const compileTool = (workflow: Workflow) =>
  tool({
    description: 'Compile the workflow to see if it is valid',
    parameters: z.object({}),
    execute: async () => {
      workflow.compile();
    },
  });

export const viewWorkflow = (workflow: Workflow) =>
  tool({
    description: 'View workflow in json',
    parameters: z.object({}),
    execute: async () => {
      return workflow.getWorkflow();
    },
  });

export const modifyTriggerTool = (workflow: Workflow) =>
  tool({
    description: 'Modify the trigger node of the workflow',
    parameters: z.object({
      cron: z.string().describe('The cron expression to schedule the workflow'),
    }),
    execute: async ({ cron }) => {
      workflow.modifyTrigger({
        type: 'cronjob-trigger',
        identifier: v4(),
        cron,
      });
      return workflow.getWorkflow();
    },
  });

export const addInputTool = (workflow: Workflow) =>
  tool({
    description:
      'Add a new input node to the workflow that provides static data. Use this when a tool requires input that should be fixed or derived from previous steps. The input node will be connected to the specified tool and provide data according to the required schema. Always call this tool if there is no parent node for the tool.',
    parameters: z.object({
      toolIdentifier: z
        .string()
        .describe(
          'The identifier (UUID) of the node after which this input node will be added. Leave empty to add at the root level.',
        ),
      output: z
        .any()
        .describe(
          "The data object containing key-value pairs that will be passed to the child node. Keys must match the child's input schema. You can use dynamic values with Jinja syntax: {{input.[property]}} to reference parent outputs or {{context.[property]}} to access global context variables.",
        ),
    }),
    execute: async ({ toolIdentifier, output }) => {
      const node: FixedInput = {
        identifier: v4(),
        type: 'fixed-input',
        output: output,
        child: null,
      };

      if (
        toolIdentifier === null ||
        (typeof toolIdentifier === 'string' && toolIdentifier.trim() === '')
      ) {
        workflow.addChild(undefined, node);
      } else {
        workflow.addChild(toolIdentifier, node);
      }
      return `Added fixed input node with identifier ${node.identifier}`;
    },
  });

export class Workflow implements WorkflowInterface {
  private workflow: WorkflowType;
  public mcpRouter: McpRouter;

  constructor(
    title: string,
    trigger: CronjobTriggerNode,
    mcpRouter: McpRouter = createMcpRouter(),
  ) {
    this.workflow = {
      title,
      trigger,
    };
    this.mcpRouter = mcpRouter;
  }

  /**
   * Type guard to check if an object is a BaseNode
   */
  private isBaseNode(obj: any): obj is BaseNode {
    return obj && typeof obj === 'object' && typeof obj.identifier === 'string';
  }

  /**
   * Type guard to check if an object is a ToolNode
   */
  private isToolNode(obj: any): obj is ToolNode {
    return (
      obj &&
      typeof obj === 'object' &&
      obj.type === 'tool' &&
      typeof obj.identifier === 'string'
    );
  }

  modifyTrigger(newTriggerNode: CronjobTriggerNode): void {
    const child = this.workflow.trigger.child;
    this.workflow.trigger = newTriggerNode;
    this.workflow.trigger.child = child;
  }

  addAfter(identifier: string | undefined, child: RegularNode): void {
    if (!identifier) {
      this.addChild(undefined, child);
      return;
    }

    const parentNode = this.findNode(identifier);
    if (!parentNode) {
      throw new Error(`Node with identifier ${identifier} not found`);
    }

    if ('child' in parentNode && parentNode.child === null) {
      (parentNode as any).child = child;
    } else if (
      'children' in parentNode &&
      Array.isArray((parentNode as any).children)
    ) {
      throw new Error(
        `Node with identifier ${identifier} has children, please use addChild instead`,
      );
    } else if ('child' in parentNode && parentNode.child) {
      const existingChild = parentNode.child;
      parentNode.child = child;
      child.child = existingChild;
    }
  }

  /**
   * Add a child node to the workflow as child of the node with the identifier.
   * If identifier is undefined, adds as child of the trigger node.
   */
  addChild(identifier: string | undefined, child: RegularNode): void {
    if (!identifier) {
      // Add as child of trigger node
      this.workflow.trigger.child = child;
      return;
    }

    const parentNode = this.findNode(identifier);
    if (!parentNode) {
      throw new Error(`Node with identifier ${identifier} not found`);
    }

    // Check if parent node can have children
    if ('child' in parentNode && parentNode.child === null) {
      (parentNode as any).child = child;
    } else if (
      'children' in parentNode &&
      Array.isArray((parentNode as any).children)
    ) {
      // For conditional nodes that can have multiple children
      (parentNode as any).children.push(child);
    } else {
      throw new Error(
        `Node with identifier ${identifier} already has a child or doesn't support children`,
      );
    }
  }

  /**
   * Remove an existing child node from the workflow. Throw an error if the node is not found.
   */
  removeChild(identifier: string): void {
    const nodeToRemove = this.findNode(identifier);
    if (!nodeToRemove) {
      throw new Error(`Node with identifier ${identifier} not found`);
    }

    // Find parent and remove the child
    const parentNode = this.findParentNode(identifier);
    if (!parentNode) {
      throw new Error(`Cannot remove root trigger node`);
    }

    if (
      'child' in parentNode &&
      parentNode.child &&
      this.isBaseNode(parentNode.child) &&
      parentNode.child.identifier === identifier
    ) {
      (parentNode as any).child = null;
    } else if (
      'children' in parentNode &&
      Array.isArray((parentNode as any).children)
    ) {
      const children = (parentNode as any).children as BaseNode[];
      const childIndex = children.findIndex(
        (child: BaseNode) => child.identifier === identifier,
      );
      if (childIndex !== -1) {
        children.splice(childIndex, 1);
      }
    }
  }

  /**
   * Modify an existing child node from the workflow. Throw an error if the node is not found.
   */
  modifyChild(identifier: string, child: RegularNode): void {
    const existingNode = this.findNode(identifier);
    if (!existingNode) {
      throw new Error(`Node with identifier ${identifier} not found`);
    }

    // Find parent and replace the child
    const parentNode = this.findParentNode(identifier);
    if (!parentNode) {
      throw new Error(`Cannot modify root trigger node`);
    }

    if (
      'child' in parentNode &&
      parentNode.child &&
      this.isBaseNode(parentNode.child) &&
      parentNode.child.identifier === identifier
    ) {
      (parentNode as any).child = child;
    } else if (
      'children' in parentNode &&
      Array.isArray((parentNode as any).children)
    ) {
      const children = (parentNode as any).children as BaseNode[];
      const childIndex = children.findIndex(
        (childNode: BaseNode) => childNode.identifier === identifier,
      );
      if (childIndex !== -1) {
        children[childIndex] = child;
      }
    }
  }

  /**
   * Check if the workflow is valid using zod and verify input/output compatibility
   */
  async compile(): Promise<WorkflowType> {
    const result = WorkflowSchema.safeParse(this.workflow);
    if (!result.success) {
      throw new Error(`Workflow validation failed: ${result.error.message}`);
    }
    const tools = this.getTools();
    const missingTools = await this.mcpRouter.checkToolsExist(tools);
    if (missingTools.missingTools.length > 0) {
      throw new WorkflowToolMissingError(missingTools.missingTools);
    }

    // Check input/output compatibility between connected nodes
    const compatibilityIssues = this.validateNodeCompatibility();
    if (compatibilityIssues.length > 0) {
      const errorMessage = compatibilityIssues.map(
        (issue) => `${issue.parentId} -> ${issue.childId}: ${issue.error}`,
      );

      const suggestionMessage = compatibilityIssues
        .filter((issue) => issue.suggestion)
        .map(
          (issue) =>
            `${issue.parentId} -> ${issue.childId}: ${issue.suggestion}`,
        );

      throw new WorkflowInputOutputMismatchError(
        errorMessage,
        suggestionMessage,
      );
    }

    return result.data;
  }

  private getTools(): string[] {
    const tools: string[] = [];
    const queue: BaseNode[] = [this.workflow.trigger];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      // If current node is a tool node, add its identifier to the list
      if (this.isToolNode(current)) {
        tools.push(current.toolIdentifier);
      }

      // Add children to queue for traversal
      if (
        'child' in current &&
        current.child &&
        this.isBaseNode(current.child)
      ) {
        queue.push(current.child);
      }
      if ('children' in current && Array.isArray((current as any).children)) {
        const children = (current as any).children as BaseNode[];
        children.forEach((child) => {
          if (this.isBaseNode(child)) {
            queue.push(child);
          }
        });
      }
    }

    return tools;
  }

  /**
   * Validate input/output compatibility between connected nodes in the workflow
   */
  private validateNodeCompatibility(): Array<{
    parentId: string;
    childId: string;
    error: string;
    suggestion: string;
  }> {
    const issues: Array<{
      parentId: string;
      childId: string;
      error: string;
      suggestion: string;
    }> = [];

    const queue: BaseNode[] = [this.workflow.trigger];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      // Check compatibility with direct child
      if (
        'child' in current &&
        current.child &&
        this.isBaseNode(current.child)
      ) {
        if (this.isToolNode(current) && this.isToolNode(current.child)) {
          const compatibility = this.checkInputAndOutputFit(
            current,
            current.child,
          );

          if (!compatibility.isInputFit) {
            issues.push({
              parentId: current.identifier,
              childId: current.child.identifier,
              error: compatibility.error,
              suggestion: compatibility.suggestion,
            });
          }
        }
        queue.push(current.child);
      }

      // Check compatibility with children array (for conditional nodes)
      if ('children' in current && Array.isArray((current as any).children)) {
        const children = (current as any).children as BaseNode[];
        children.forEach((child) => {
          if (this.isBaseNode(child)) {
            if (this.isToolNode(current) && this.isToolNode(child)) {
              const compatibility = this.checkInputAndOutputFit(current, child);

              if (!compatibility.isInputFit) {
                issues.push({
                  parentId: current.identifier,
                  childId: child.identifier,
                  error: compatibility.error,
                  suggestion: compatibility.suggestion,
                });
              }
            }
            queue.push(child);
          }
        });
      }
    }

    return issues;
  }

  /**
   * Construct a workflow from a JSON object
   */
  static readFrom(workflow: WorkflowType): Workflow {
    const result = WorkflowSchema.safeParse(workflow);
    if (!result.success) {
      throw new Error(`Invalid workflow format: ${result.error.message}`);
    }
    return new Workflow(result.data.title, result.data.trigger);
  }

  /**
   * Find a node by identifier in the workflow tree
   */
  findNode(identifier: string): BaseNode | null {
    const queue: BaseNode[] = [this.workflow.trigger];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      if (current.identifier === identifier) {
        return current;
      }

      // Add children to queue for traversal
      if (
        'child' in current &&
        current.child &&
        this.isBaseNode(current.child)
      ) {
        queue.push(current.child);
      }
      if ('children' in current && Array.isArray((current as any).children)) {
        const children = (current as any).children as BaseNode[];
        children.forEach((child) => {
          if (this.isBaseNode(child)) {
            queue.push(child);
          }
        });
      }
    }

    return null;
  }

  /**
   * Find the parent node of a given identifier
   */
  private findParentNode(identifier: string): BaseNode | null {
    const queue: BaseNode[] = [this.workflow.trigger];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      // Check if any child matches the identifier
      if (
        'child' in current &&
        current.child &&
        this.isBaseNode(current.child) &&
        current.child.identifier === identifier
      ) {
        return current;
      }
      if ('children' in current && Array.isArray((current as any).children)) {
        const children = (current as any).children as BaseNode[];
        const hasChild = children.some(
          (child: BaseNode) =>
            this.isBaseNode(child) && child.identifier === identifier,
        );
        if (hasChild) {
          return current;
        }
        children.forEach((child) => {
          if (this.isBaseNode(child)) {
            queue.push(child);
          }
        });
      }

      // Continue traversal
      if (
        'child' in current &&
        current.child &&
        this.isBaseNode(current.child)
      ) {
        queue.push(current.child);
      }
    }

    return null;
  }

  /**
   * Get the workflow data
   */
  getWorkflow(): WorkflowType {
    return this.workflow;
  }

  /**
   * Get workflow title
   */
  getTitle(): string {
    return this.workflow.title;
  }

  /**
   * Get workflow trigger
   */
  getTrigger(): CronjobTriggerNode {
    return this.workflow.trigger;
  }

  /**
   * Check if the output of the parent node fits the input of the child node
   * using json schema.
   */
  checkInputAndOutputFit(
    parent: ToolNode,
    child: ToolNode,
  ): {
    isInputFit: boolean;
    suggestion: string;
    error: string;
  } {
    try {
      const parentOutput = parent.outputSchema?.properties || {};
      const childInput = child.inputSchema?.properties || {};

      const errors: string[] = [];
      const suggestions: string[] = [];

      // Check if parent has any output properties
      const parentOutputKeys = Object.keys(parentOutput);
      const childInputKeys = Object.keys(childInput);

      if (parentOutputKeys.length === 0 && childInputKeys.length > 0) {
        errors.push(
          `Child node ${child.identifier} expects input properties but parent node ${parent.identifier} has no output properties`,
        );
        suggestions.push(
          `Ensure parent node ${parent.identifier} produces output properties: ${childInputKeys.join(', ')}`,
        );
        return {
          isInputFit: false,
          suggestion: suggestions.join('. '),
          error: errors.join('. '),
        };
      }

      // Check for missing properties
      const missingProperties: string[] = [];

      for (const [childProp, childSchema] of Object.entries(childInput)) {
        if (!(childProp in parentOutput)) {
          missingProperties.push(childProp);
        } else {
          // Check deep compatibility for this property
          const parentPropSchema = parentOutput[childProp];
          const compatibilityResult = this.checkSchemaCompatibility(
            parentPropSchema,
            childSchema,
            `${parent.identifier}.${childProp}`,
            `${child.identifier}.${childProp}`,
          );

          if (!compatibilityResult.isCompatible) {
            errors.push(...compatibilityResult.errors);
            suggestions.push(...compatibilityResult.suggestions);
          }
        }
      }

      // Check for extra properties that child doesn't expect
      const extraProperties = parentOutputKeys.filter(
        (prop) => !childInputKeys.includes(prop),
      );

      // Build error messages for missing properties
      if (missingProperties.length > 0) {
        errors.push(
          `Child node ${child.identifier} expects properties [${missingProperties.join(', ')}] but parent node ${parent.identifier} outputs [${parentOutputKeys.join(', ')}]`,
        );

        // Try to suggest property name mappings based on similarity
        const mappingSuggestions = missingProperties.map((missing) => {
          const similar = parentOutputKeys.find(
            (parentProp) =>
              parentProp.toLowerCase().includes(missing.toLowerCase()) ||
              missing.toLowerCase().includes(parentProp.toLowerCase()),
          );
          return similar
            ? `Consider mapping '${similar}' to '${missing}'`
            : `Add '${missing}' to parent output`;
        });
        suggestions.push(...mappingSuggestions);
      }

      if (
        extraProperties.length > 0 &&
        missingProperties.length === 0 &&
        errors.length === 0
      ) {
        suggestions.push(
          `Parent outputs extra properties [${extraProperties.join(', ')}] that child doesn't use - this is acceptable but may indicate inefficiency`,
        );
      }

      const isInputFit = errors.length === 0;

      return {
        isInputFit,
        suggestion:
          suggestions.length > 0
            ? suggestions.join('. ')
            : isInputFit
              ? 'Schema compatibility is perfect'
              : '',
        error: errors.join('. '),
      };
    } catch (error) {
      return {
        isInputFit: false,
        suggestion: 'Check that both nodes have valid JSON schemas',
        error: `Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Recursively check schema compatibility for nested structures
   */
  private checkSchemaCompatibility(
    parentSchema: any,
    childSchema: any,
    parentPath: string,
    childPath: string,
  ): {
    isCompatible: boolean;
    errors: string[];
    suggestions: string[];
  } {
    const errors: string[] = [];
    const suggestions: string[] = [];

    const parentType = parentSchema?.type;
    const childType = childSchema?.type;

    // Check basic type compatibility
    if (parentType && childType && parentType !== childType) {
      errors.push(
        `Property '${childPath}' expects type '${childType}' but parent outputs type '${parentType}'`,
      );
      suggestions.push(`Ensure type compatibility for property '${childPath}'`);
      return { isCompatible: false, errors, suggestions };
    }

    // Handle object types
    if (parentType === 'object' && childType === 'object') {
      const parentProps = parentSchema?.properties || {};
      const childProps = childSchema?.properties || {};

      const childPropKeys = Object.keys(childProps);
      const parentPropKeys = Object.keys(parentProps);

      // Check for missing nested properties
      const missingNestedProps = childPropKeys.filter(
        (prop) => !(prop in parentProps),
      );
      if (missingNestedProps.length > 0) {
        errors.push(
          `Nested object '${childPath}' expects properties [${missingNestedProps.join(', ')}] but parent '${parentPath}' provides [${parentPropKeys.join(', ')}]`,
        );
        suggestions.push(
          `Add missing properties to '${parentPath}': ${missingNestedProps.join(', ')}`,
        );
      }

      // Recursively check nested properties
      for (const [prop, childPropSchema] of Object.entries(childProps)) {
        if (prop in parentProps) {
          const nestedResult = this.checkSchemaCompatibility(
            parentProps[prop],
            childPropSchema,
            `${parentPath}.${prop}`,
            `${childPath}.${prop}`,
          );
          errors.push(...nestedResult.errors);
          suggestions.push(...nestedResult.suggestions);
        }
      }
    }

    // Handle array types
    if (parentType === 'array' && childType === 'array') {
      const parentItems = parentSchema?.items;
      const childItems = childSchema?.items;

      if (parentItems && childItems) {
        const arrayItemResult = this.checkSchemaCompatibility(
          parentItems,
          childItems,
          `${parentPath}[items]`,
          `${childPath}[items]`,
        );
        errors.push(...arrayItemResult.errors);
        suggestions.push(...arrayItemResult.suggestions);
      } else if (childItems && !parentItems) {
        errors.push(
          `Array '${childPath}' expects specific item schema but parent '${parentPath}' has no item schema defined`,
        );
        suggestions.push(`Define item schema for array '${parentPath}'`);
      }
    }

    // Handle array of objects
    if (
      parentType === 'array' &&
      parentSchema?.items?.type === 'object' &&
      childType === 'array' &&
      childSchema?.items?.type === 'object'
    ) {
      const parentItemProps = parentSchema?.items?.properties || {};
      const childItemProps = childSchema?.items?.properties || {};

      const childItemPropKeys = Object.keys(childItemProps);
      const parentItemPropKeys = Object.keys(parentItemProps);

      const missingItemProps = childItemPropKeys.filter(
        (prop) => !(prop in parentItemProps),
      );
      if (missingItemProps.length > 0) {
        errors.push(
          `Array items in '${childPath}' expect properties [${missingItemProps.join(', ')}] but parent '${parentPath}' item provides [${parentItemPropKeys.join(', ')}]`,
        );
        suggestions.push(
          `Add missing item properties to '${parentPath}': ${missingItemProps.join(', ')}`,
        );
      }

      // Recursively check array item properties
      for (const [prop, childItemPropSchema] of Object.entries(
        childItemProps,
      )) {
        if (prop in parentItemProps) {
          const nestedResult = this.checkSchemaCompatibility(
            parentItemProps[prop],
            childItemPropSchema,
            `${parentPath}[items].${prop}`,
            `${childPath}[items].${prop}`,
          );
          errors.push(...nestedResult.errors);
          suggestions.push(...nestedResult.suggestions);
        }
      }
    }

    return {
      isCompatible: errors.length === 0,
      errors,
      suggestions,
    };
  }
}
