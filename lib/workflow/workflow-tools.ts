import { tool } from 'ai';
import { v4 } from 'uuid';
import { z } from 'zod';
import { compileCode } from '../agent/runtime/runner-environment';
import type {
  BooleanNode,
  ConditionNode,
  ConverterNode,
  FixedInput,
  RegularNode,
  SkipNode,
  ToolNode,
  UpsertStateNode,
} from './types';
import { TodoItemSchema } from './types';
import type { Workflow } from './workflow';
import type { TodoList } from './todolist/todolist';

const createChildNode = async (
  childNode: any,
  childId: string,
  workflow: Workflow,
): Promise<RegularNode> => {
  switch (childNode.type) {
    case 'tool': {
      if (!childNode.toolIdentifier)
        throw new Error('toolIdentifier required for tool node');
      const toolInfo = await workflow.mcpRouter.getToolInfo(
        childNode.toolIdentifier,
      );
      return {
        identifier: childId,
        type: 'tool',
        toolIdentifier: childNode.toolIdentifier,
        child: null,
        description: toolInfo.description,
        inputSchema: toolInfo.inputSchema,
        outputSchema: toolInfo.outputSchema,
      } as ToolNode;
    }
    case 'converter':
      if (!childNode.code) throw new Error('code required for converter node');
      return {
        identifier: childId,
        type: 'converter',
        code: childNode.code,
        runtime: 'js',
        child: null,
      } as ConverterNode;
    case 'boolean':
      if (!childNode.code) throw new Error('code required for boolean node');
      return {
        identifier: childId,
        type: 'boolean',
        code: childNode.code,
        runtime: 'js',
        trueChild: null,
        falseChild: null,
      } as BooleanNode;
    case 'fixed-input':
      if (!childNode.output)
        throw new Error('output required for fixed-input node');
      return {
        identifier: childId,
        type: 'fixed-input',
        output: JSON.parse(childNode.output),
        child: null,
      } as FixedInput;
    case 'upsert-state':
      if (!childNode.key) throw new Error('key required for upsert-state node');
      if (childNode.value === undefined)
        throw new Error('value required for upsert-state node');
      return {
        identifier: childId,
        type: 'upsert-state',
        key: childNode.key,
        value: childNode.value,
        child: null,
      } as UpsertStateNode;
    case 'skip':
      return {
        identifier: childId,
        type: 'skip',
        child: null,
      } as SkipNode;
    default:
      throw new Error(`Unsupported child node type: ${childNode.type}`);
  }
};

export const addToolNodeTool = (workflow: Workflow) =>
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
        console.log('added tool node');
        console.log(workflow.toViewableString());
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
      try {
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
        console.log('added condition node');
        console.log(workflow.toViewableString());
        return `Added condition node with identifier ${node.identifier}`;
      } catch (error) {
        return {
          error: error,
        };
      }
    },
  });

export const addBooleanNodeTool = (workflow: Workflow) =>
  tool({
    description:
      'Add a new boolean node to the workflow for true/false conditional branching',
    parameters: z.object({
      parentIdentifier: z
        .string()
        .nullable()
        .describe(
          'The identifier for the parent node that this boolean node will be added as child of. Empty if it should be added after trigger.',
        ),
      code: z
        .string()
        .describe(
          'The code for the boolean condition. Should be in the format: async function handle(input: Record<string, any>): Promise<boolean>. The return value determines which child path to take (true or false).',
        ),
    }),
    execute: async ({ parentIdentifier, code }) => {
      try {
        const node: BooleanNode = {
          identifier: v4(),
          type: 'boolean',
          code: code,
          runtime: 'js',
          trueChild: null,
          falseChild: null,
        };

        if (parentIdentifier) {
          workflow.addChild(parentIdentifier, node);
        } else {
          workflow.addChild(undefined, node);
        }

        console.log('added boolean node');
        console.log(workflow.toViewableString());
        return `Added boolean node with identifier ${node.identifier}`;
      } catch (error) {
        return {
          error: error,
        };
      }
    },
  });

export const addBooleanTrueChildTool = (workflow: Workflow) =>
  tool({
    description: 'Add a true child node to an existing boolean node',
    parameters: z.object({
      booleanNodeId: z.string().describe('The identifier of the boolean node'),
      childNode: z.object({
        type: z.enum([
          'tool',
          'converter',
          'condition',
          'boolean',
          'fixed-input',
          'upsert-state',
          'skip',
        ]),
        toolIdentifier: z
          .string()
          .optional()
          .describe('Required if type is tool'),
        code: z
          .string()
          .optional()
          .describe('Required if type is converter, condition, or boolean'),
        output: z.any().optional().describe('Required if type is fixed-input'),
        key: z.string().optional().describe('Required if type is upsert-state'),
        value: z.any().optional().describe('Required if type is upsert-state'),
      }),
    }),
    execute: async ({ booleanNodeId, childNode }) => {
      try {
        const booleanNode = workflow.findNode(booleanNodeId) as any;
        if (!booleanNode || booleanNode.type !== 'boolean') {
          return `Boolean node with identifier ${booleanNodeId} not found`;
        }

        if (booleanNode.trueChild !== null) {
          return `Boolean node ${booleanNodeId} already has a true child`;
        }

        const childId = v4();
        const newChild = await createChildNode(childNode, childId, workflow);

        booleanNode.trueChild = newChild;
        console.log('added true child to boolean node');
        console.log(workflow.toViewableString());
        return `Added true child node with identifier ${childId} to boolean node ${booleanNodeId}`;
      } catch (error) {
        return { error: error };
      }
    },
  });

export const addBooleanFalseChildTool = (workflow: Workflow) =>
  tool({
    description: 'Add a false child node to an existing boolean node',
    parameters: z.object({
      booleanNodeId: z.string().describe('The identifier of the boolean node'),
      childNode: z.object({
        type: z.enum([
          'tool',
          'converter',
          'condition',
          'boolean',
          'fixed-input',
          'upsert-state',
          'skip',
        ]),
        toolIdentifier: z
          .string()
          .optional()
          .describe('Required if type is tool'),
        code: z
          .string()
          .optional()
          .describe('Required if type is converter, condition, or boolean'),
        output: z.any().optional().describe('Required if type is fixed-input'),
        key: z.string().optional().describe('Required if type is upsert-state'),
        value: z.any().optional().describe('Required if type is upsert-state'),
      }),
    }),
    execute: async ({ booleanNodeId, childNode }) => {
      try {
        const booleanNode = workflow.findNode(booleanNodeId) as any;
        if (!booleanNode || booleanNode.type !== 'boolean') {
          return `Boolean node with identifier ${booleanNodeId} not found`;
        }

        if (booleanNode.falseChild !== null) {
          return `Boolean node ${booleanNodeId} already has a false child`;
        }

        const childId = v4();
        const newChild = await createChildNode(childNode, childId, workflow);

        booleanNode.falseChild = newChild;
        console.log('added false child to boolean node');
        console.log(workflow.toViewableString());
        return `Added false child node with identifier ${childId} to boolean node ${booleanNodeId}`;
      } catch (error) {
        return { error: error };
      }
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
              return input.input;
            }
  
            The input is the output of the tool with the identifier 'toolIdentifier'.
            The output should follow the targeted output schema. Note: Always use input.input[field] to access the field of the input and input.state[field] to access the field of the state.
            `),
    }),
    execute: async ({ toolIdentifier, code }) => {
      try {
        await compileCode(code, 'typescript');

        const node: ConverterNode = {
          identifier: v4(),
          type: 'converter',
          code: code,
          child: null,
          runtime: 'js',
        };
        workflow.addAfter(toolIdentifier, node);
        console.log('added converter node');
        console.log(workflow.toViewableString());
        return `Added converter node with identifier ${node.identifier}`;
      } catch (error) {
        return {
          error: error,
        };
      }
    },
  });

export const removeNodeTool = (workflow: Workflow) =>
  tool({
    description: 'Remove a node from the workflow',
    parameters: z.object({
      identifier: z.string(),
    }),
    execute: async ({ identifier }) => {
      try {
        workflow.removeChild(identifier);
        console.log('removed node');
        console.log(workflow.toViewableString());
        return `Removed node with identifier ${identifier}`;
      } catch (error) {
        return {
          error: error,
        };
      }
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
      try {
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
        console.log('modified tool node');
        console.log(workflow.toViewableString());
        return `Modified tool node with identifier ${id} to ${node.toolIdentifier}`;
      } catch (error) {
        return {
          error: error,
        };
      }
    },
  });

export const compileTool = (workflow: Workflow) =>
  tool({
    description: 'Compile the workflow to see if it is valid',
    parameters: z.object({}),
    execute: async () => {
      try {
        await workflow.compile();
        return 'Workflow compiled successfully';
      } catch (error) {
        return {
          error: error,
        };
      }
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
      try {
        workflow.modifyTrigger({
          type: 'cronjob-trigger',
          identifier: v4(),
          cron,
        });
        console.log('modified trigger node');
        console.log(workflow.toViewableString());
        return workflow.getWorkflow();
      } catch (error) {
        return {
          error: error,
        };
      }
    },
  });

export const swapNodesTool = (workflow: Workflow) =>
  tool({
    description:
      'Swap two nodes in the workflow but still keep their children intact',
    parameters: z.object({
      identifier1: z.string().describe('The identifier of the first node'),
      identifier2: z.string().describe('The identifier of the second node'),
    }),
    execute: async ({ identifier1, identifier2 }) => {
      try {
        workflow.swapNodes(identifier1, identifier2);
        console.log('swapped nodes', identifier1, identifier2);
        console.log(workflow.toViewableString());
        return `Swapped nodes ${identifier1} and ${identifier2}`;
      } catch (error) {
        return {
          error: error,
        };
      }
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
          'The identifier (UUID) of the node after which this input node will be added. Leave empty to add at the root level. If the suggestion is saying to add an node between two nodes, use the identifier of the node after which the input node will be added.',
        ),
      output: z
        .string()
        .describe(
          "The data object containing key-value pairs that will be passed to the child node. Keys must match the child's input schema. You can use dynamic values with Jinja syntax: {{input.[property]}} to reference parent outputs or {{context.[property]}} to access global context variables.",
        ),
    }),
    execute: async ({ toolIdentifier, output }) => {
      try {
        const node: FixedInput = {
          identifier: v4(),
          type: 'fixed-input',
          output: JSON.parse(output),
          child: null,
        };

        if (
          toolIdentifier === null ||
          (typeof toolIdentifier === 'string' && toolIdentifier.trim() === '')
        ) {
          workflow.addAfter(undefined, node);
        } else {
          workflow.addAfter(toolIdentifier, node);
        }
        console.log('added input node');
        console.log(workflow.toViewableString());
        return `Added fixed input node with identifier ${node.identifier}`;
      } catch (error) {
        return {
          error: error,
        };
      }
    },
  });

export const addUpsertStateNodeTool = (workflow: Workflow) =>
  tool({
    description:
      'Add a new upsert state node to the workflow that stores a key-value pair and outputs the value. The added state can be access by using input.state[key]',
    parameters: z.object({
      parentIdentifier: z
        .string()
        .nullable()
        .describe(
          'The identifier of the node after which this upsert state node will be added. Leave empty to add at the root level.',
        ),
      key: z.string().describe('The key to store in the state store.'),
      value: z
        .any()
        .describe(
          'The value to store in the state store. This value will also be output by the node.',
        ),
    }),
    execute: async ({ parentIdentifier, key, value }) => {
      try {
        const node: UpsertStateNode = {
          identifier: v4(),
          type: 'upsert-state',
          key,
          value,
          child: null,
        };

        if (
          parentIdentifier === null ||
          (typeof parentIdentifier === 'string' &&
            parentIdentifier.trim() === '')
        ) {
          workflow.addAfter(undefined, node);
        } else {
          workflow.addAfter(parentIdentifier, node);
        }
        console.log('added upsert state node');
        console.log(workflow.toViewableString());
        return `Added upsert state node with key "${key}" and identifier ${node.identifier}`;
      } catch (error) {
        return {
          error: error,
        };
      }
    },
  });

export const addSkipNodeTool = (workflow: Workflow) =>
  tool({
    description:
      'Add a new skip node to the workflow that terminates workflow execution and returns whatever output it receives',
    parameters: z.object({
      parentIdentifier: z
        .string()
        .nullable()
        .describe(
          'The identifier of the node after which this skip node will be added. Leave empty to add at the root level.',
        ),
    }),
    execute: async ({ parentIdentifier }) => {
      try {
        const node: SkipNode = {
          identifier: v4(),
          type: 'skip',
          child: null,
        };

        if (
          parentIdentifier === null ||
          (typeof parentIdentifier === 'string' &&
            parentIdentifier.trim() === '')
        ) {
          workflow.addAfter(undefined, node);
        } else {
          workflow.addAfter(parentIdentifier, node);
        }
        console.log('added skip node');
        console.log(workflow.toViewableString());
        return `Added skip node with identifier ${node.identifier}`;
      } catch (error) {
        return {
          error: error,
        };
      }
    },
  });

export const addTodoListItemsTool = (todoList: TodoList) =>
  tool({
    description:
      'Add items to the todo list. Sort the items by the workflow execution order.',
    parameters: z.object({
      items: z
        .array(TodoItemSchema.omit({ id: true }))
        .describe('Todo items to add to the list'),
    }),
    execute: async ({ items }) => {
      todoList.addItems(items);
      return {
        todoList: todoList.toViewableString(),
        message: `Added ${items.length} items to todo list`,
      };
    },
  });

export const markAsComplete = (todoList: TodoList) =>
  tool({
    description:
      'Mark items as completed in the todo list. Please always call this tool when part of the todo list is completed.',
    parameters: z.object({
      markCompleted: z
        .array(z.number())
        .optional()
        .describe('Indexes of items to mark as completed'),
    }),
    execute: async ({ markCompleted }) => {
      if (markCompleted && markCompleted.length > 0) {
        markCompleted.forEach((index) =>
          todoList.markAsCompletedByIndex(index),
        );
      }

      return {
        todoList: todoList.toViewableString(),
        message: `Updated todo list. Marked ${markCompleted?.length || 0} as completed`,
      };
    },
  });
