import { tool } from 'ai';
import { v4 } from 'uuid';
import { z } from 'zod';
import type {
  BaseNode,
  CronjobTriggerNode,
  RegularNode,
  ToolNode,
  Workflow as WorkflowType,
} from './types';
import { WorkflowSchema } from './types';

export interface WorkflowInterface {
  // Add a child node to the workflow as child of the node with the identifier.
  addChild(identifier: string | undefined, child: RegularNode): void;
  // Remove a existing child node from the workflow. Throw an error if the node is not found.
  removeChild(identifier: string): void;
  // Modify a existing child node from the workflow. Throw an error if the node is not found.
  modifyChild(identifier: string, child: RegularNode): void;
  // Check if the workflow is valid using zod
  compile(): WorkflowType;
  // Construct a workflow from a JSON object
  readFrom(workflow: WorkflowType): void;
}

export const addNodeTool = (workflow: Workflow) =>
  tool({
    description: 'Add a new tool node to the workflow',
    parameters: z.object({
      id: z
        .string()
        .nullable()
        .describe(
          'The id this node would be added after. Null if it is added after the trigger node (root).' +
            'This id is different from the tool identifier, which is used to find the tool in the tool registry.',
        ),
      toolIdentifier: z.string().describe("The tool's unique identifier"),
    }),
    execute: async ({ id, toolIdentifier }) => {
      try {
        const node: ToolNode = {
          identifier: v4(),
          type: 'tool',
          toolIdentifier,
          child: null,
        };
        if (id === null || (typeof id === 'string' && id.trim() === '')) {
          workflow.addChild(undefined, node);
        } else {
          workflow.addChild(id, node);
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
      identifier: z
        .string()
        .nullable()
        .describe(
          'The identifier for the condition node to be added as child of the node with the identifier. Empty if it added as root.',
        ),
      code: z
        .string()
        .optional()
        .describe(
          `The code for the condition. Should be in the format export async function handle(input: Record<string, any>): Promise<string>. The return is the next tool identifier to use`,
        ),
    }),
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

export class Workflow implements WorkflowInterface {
  private workflow: WorkflowType;

  constructor(title: string, trigger: CronjobTriggerNode) {
    this.workflow = {
      title,
      trigger,
    };
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
  compile(): WorkflowType {
    const result = WorkflowSchema.safeParse(this.workflow);
    if (!result.success) {
      throw new Error(`Workflow validation failed: ${result.error.message}`);
    }

    // Check input/output compatibility between connected nodes
    const compatibilityIssues = this.validateNodeCompatibility();
    if (compatibilityIssues.length > 0) {
      const errorMessage = compatibilityIssues
        .map((issue) => `${issue.parentId} -> ${issue.childId}: ${issue.error}`)
        .join('\n');
      const suggestionMessage = compatibilityIssues
        .filter((issue) => issue.suggestion)
        .map(
          (issue) =>
            `${issue.parentId} -> ${issue.childId}: ${issue.suggestion}`,
        )
        .join('\n');

      throw new Error(
        `Workflow compilation failed due to input/output compatibility issues:\n${errorMessage}${suggestionMessage ? `\n\nSuggestions:\n${suggestionMessage}` : ''}`,
      );
    }

    return result.data;
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
  readFrom(workflow: WorkflowType): void {
    const result = WorkflowSchema.safeParse(workflow);
    if (!result.success) {
      throw new Error(`Invalid workflow format: ${result.error.message}`);
    }
    this.workflow = result.data;
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
