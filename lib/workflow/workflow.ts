import { tool } from 'ai';
import type {
  BaseNode,
  CronjobTriggerNode,
  RegularNode,
  ToolNode,
  Workflow as WorkflowType,
} from './types';
import { RegularNodeSchema, WorkflowSchema } from './types';
import { z } from 'zod';
import { v4 } from 'uuid';

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
   * Check if the workflow is valid using zod
   */
  compile(): WorkflowType {
    const result = WorkflowSchema.safeParse(this.workflow);
    if (!result.success) {
      throw new Error(`Workflow validation failed: ${result.error.message}`);
    }
    return result.data;
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
}
