import { z } from 'zod';
import { isValidCron } from 'cron-validator';
import type {
  JSCodeExecutionEngine,
  ToolExecutionEngine,
} from './workflow-engine';

const BaseNodeSchema = z.object({
  identifier: z
    .string()
    .describe('random generated identifier for the node')
    .uuid(),
});

export type BaseNode = z.infer<typeof BaseNodeSchema>;

export const RuntimeCodeSchema = z.discriminatedUnion('runtime', [
  z.object({
    runtime: z.literal('js'),
    code: z.string().describe('JavaScript code to execute for this condition'),
  }),
]);

export type RuntimeCode = z.infer<typeof RuntimeCodeSchema>;

// Schema for regular nodes that can only have one parent and one child
// Using z.lazy() for forward references to avoid circular dependency
export const RegularNodeSchema = BaseNodeSchema.extend({
  /**
   * The child node of the current node.
   * Uses z.lazy to allow for forward references and avoid circular dependency issues.
   * Can be a ToolNode, ConverterNode, ConditionNode, or FixedInputSchema, or undefined.
   */
  child: z
    .union([
      z.lazy((): any => ToolNodeSchema),
      z.lazy((): any => ConverterNodeSchema),
      z.lazy((): any => ConditionNodeSchema),
      z.lazy((): any => BooleanNodeSchema),
      z.lazy((): any => FixedInputSchema),
      z.lazy((): any => UpsertStateNodeSchema),
      z.lazy((): any => SkipNodeSchema),
    ])
    .nullable()
    .describe('child node of the current node'),
}).strict();

export type RegularNode = z.infer<typeof RegularNodeSchema>;

// Schema for conditional nodes that can have multiple parents and children
export const ConditionalNodeSchema = BaseNodeSchema.extend({
  children: z
    .array(
      z.lazy((): any =>
        z.union([
          ToolNodeSchema,
          ConverterNodeSchema,
          ConditionNodeSchema,
          BooleanNodeSchema,
          FixedInputSchema,
          UpsertStateNodeSchema,
          SkipNodeSchema,
        ]),
      ),
    )
    .describe('children nodes of the current node'),
}).strict();

export type ConditionalNode = z.infer<typeof ConditionalNodeSchema>;

// Legacy Node schema for backward compatibility (deprecated)
export const NodeSchema = BaseNodeSchema.extend({
  children: z
    .array(z.lazy(() => BaseNodeSchema))
    .describe('children nodes of the current node'),
});

export type Node = z.infer<typeof NodeSchema>;

/**
 * Condition node runs check on the inputs and determines the next node to run
 * Can have multiple parents and children
 */
export const ConditionNodeSchema = ConditionalNodeSchema.extend({
  type: z.literal('condition'),
  runtime: z.literal('js'),
  children: z
    .array(
      z.lazy((): any =>
        z.union([
          ToolNodeSchema,
          ConverterNodeSchema,
          ConditionNodeSchema,
          BooleanNodeSchema,
          FixedInputSchema,
          UpsertStateNodeSchema,
          SkipNodeSchema,
        ]),
      ),
    )
    .describe('children nodes of the current node'),
  code: z.string().describe('JavaScript code to execute for this condition'),
}).strict();

export type ConditionNode = z.infer<typeof ConditionNodeSchema>;

/**
 * Boolean node is a simplified condition node that evaluates to true/false
 * and has exactly two child nodes: trueChild and falseChild
 */
export const BooleanNodeSchema = BaseNodeSchema.extend({
  type: z.literal('boolean'),
  runtime: z.literal('js'),
  code: z.string().describe('JavaScript code that evaluates to a boolean'),
  trueChild: z
    .lazy((): any =>
      z.union([
        ToolNodeSchema,
        ConverterNodeSchema,
        ConditionNodeSchema,
        BooleanNodeSchema,
        FixedInputSchema,
        UpsertStateNodeSchema,
        SkipNodeSchema,
      ]),
    )
    .nullable()
    .optional()
    .describe('child node to execute when condition is true'),
  falseChild: z
    .lazy((): any =>
      z.union([
        ToolNodeSchema,
        ConverterNodeSchema,
        ConditionNodeSchema,
        BooleanNodeSchema,
        FixedInputSchema,
        UpsertStateNodeSchema,
        SkipNodeSchema,
      ]),
    )
    .nullable()
    .optional()
    .describe('child node to execute when condition is false'),
}).strict();

export type BooleanNode = z.infer<typeof BooleanNodeSchema>;

/**
 * Tool node can only have one parent and one child
 */
export const ToolNodeSchema = RegularNodeSchema.extend({
  type: z.literal('tool'),
  toolIdentifier: z.string().describe('identifier of the tool to execute'),
  description: z.string().nullable(),
  inputSchema: z.any().describe('input schema of the tool'),
  outputSchema: z.any().describe('output schema of the tool'),
}).strict();

export type ToolNode = z.infer<typeof ToolNodeSchema>;

/**
 * Converter node can only have one parent and one child
 */
export const ConverterNodeSchema = RegularNodeSchema.extend({
  type: z.literal('converter'),
  runtime: z.literal('js'),
  code: z.string().describe('JavaScript code to execute for this converter'),
}).strict();

export type ConverterNode = z.infer<typeof ConverterNodeSchema>;

/**
 * Trigger node can only have one child (no parents as it's the entry point)
 */
export const TriggerNodeSchema = BaseNodeSchema.extend({
  type: z.literal('trigger'),
  child: z
    .lazy((): any =>
      z.union([
        ToolNodeSchema,
        ConverterNodeSchema,
        ConditionNodeSchema,
        BooleanNodeSchema,
        FixedInputSchema,
        UpsertStateNodeSchema,
        SkipNodeSchema,
      ]),
    )
    .nullable(),
}).strict();

export type TriggerNode = z.infer<typeof TriggerNodeSchema>;

/**
 * Trigger node is the entry point of the workflow that
 * starts the workflow execution on a schedule or on demand
 * Can only have one child (no parents as it's the entry point)
 */
export const CronjobTriggerNodeSchema = TriggerNodeSchema.extend({
  type: z.literal('cronjob-trigger'),
  /**
   * Cron time for crojob, must match standard cron syntax:
   * minute hour day month weekday (e.g. "0 0 * * *")
   */
  cron: z
    .string()
    .refine((value) => isValidCron(value), {
      message:
        'Must be a valid cron expression (minute hour day month weekday)',
    })
    .describe('cron time for crojob, e.g. "0 0 * * *"'),
}).strict();

export type CronjobTriggerNode = z.infer<typeof CronjobTriggerNodeSchema>;

export const WorkflowSchema = z.object({
  title: z.string().min(1).describe('title of the workflow'),
  trigger: z.discriminatedUnion('type', [CronjobTriggerNodeSchema]),
});

export type Workflow = z.infer<typeof WorkflowSchema>;

export const ConditionNodeInputSchema = z.object({
  input: z.any().describe('The input to the condition node'),
  nodeId: z.string().describe('The id of the condition node'),
});

export type ConditionNodeInput = z.infer<typeof ConditionNodeInputSchema>;

export const ConditionNodeExecutionInputSchema = z
  .array(ConditionNodeInputSchema)
  .describe('The inputs to the condition node');

export type ConditionNodeExecutionInput = z.infer<
  typeof ConditionNodeExecutionInputSchema
>;

export const ConditionNodeExecutionResultSchema = z
  .string()
  .describe('The next node to be executed. Null means exit')
  .nullable();

export type ConditionNodeExecutionResult = z.infer<
  typeof ConditionNodeExecutionResultSchema
>;

export const BooleanNodeExecutionResultSchema = z
  .boolean()
  .describe('The boolean result that determines which child node to execute');

export type BooleanNodeExecutionResult = z.infer<
  typeof BooleanNodeExecutionResultSchema
>;

export const ConverterNodeExecutionResultSchema = z
  .any()
  .describe(
    "The output that converts from the input node and matches the child's input schema",
  )
  .transform((value: any) => {
    if (typeof value === 'object' || Array.isArray(value)) {
      return JSON.parse(JSON.stringify(value)); // Ensure deep copy of objects/arrays
    } else {
      return value; // For primitive types, return as is
    }
  });

export type ConverterNodeExecutionResult = z.infer<
  typeof ConverterNodeExecutionResultSchema
>;

export const DiscoverySchema = z.object({
  selectedTools: z.array(z.string()).describe('The selected tools identifiers'),
  reasoning: z
    .string()
    .describe('The reasoning for the selected tools less than 100 words'),
});

export const SuggestionSchema = z.object({
  modifications: z
    .array(z.string())
    .describe(
      'The modifications for the workflow. If you think there is no modification needed, return an empty array.',
    )
    .optional(),
  skipToolDiscovery: z
    .boolean()
    .describe('Whether to skip the tool discovery step'),
});

export const FixedInputSchema = BaseNodeSchema.extend({
  type: z.literal('fixed-input'),
  output: z.record(z.string(), z.any()).describe('The output of the workflow'),
  child: z
    .union([
      z.lazy((): any => ToolNodeSchema),
      z.lazy((): any => ConverterNodeSchema),
      z.lazy((): any => ConditionNodeSchema),
      z.lazy((): any => BooleanNodeSchema),
      z.lazy((): any => FixedInputSchema),
      z.lazy((): any => UpsertStateNodeSchema),
      z.lazy((): any => SkipNodeSchema),
    ])
    .nullable()
    .describe('child node of the current node'),
}).describe(
  'This is a fixed input node that can be used to provide a fixed input to the workflow. It accepts jinja2 syntax so that your output can use {{input.name}} or {{context.name}} to access the input or context',
);

export type FixedInput = z.infer<typeof FixedInputSchema>;

/**
 * Upsert state node that stores a key-value pair and outputs the value
 */
export const UpsertStateNodeSchema = RegularNodeSchema.extend({
  type: z.literal('upsert-state'),
  key: z.string().describe('The key to store in the state store'),
  value: z.any().describe('The value to store in the state store'),
}).strict();

export type UpsertStateNode = z.infer<typeof UpsertStateNodeSchema>;

/**
 * Skip node that terminates workflow execution and returns whatever output it receives
 */
export const SkipNodeSchema = RegularNodeSchema.extend({
  type: z.literal('skip'),
}).strict();

export type SkipNode = z.infer<typeof SkipNodeSchema>;

export type WorkflowOptions = {
  toolExecutionEngine?: ToolExecutionEngine;
  jsExecutionEngine?: JSCodeExecutionEngine;
};

export type ExtraContext = {
  state: Record<string, any>;
} & Record<string, any>;

// Todo List Schemas
export const TodoItemSchema = z.object({
  id: z.string().describe('ID of the todo item'),
  title: z.string().describe('Title of the todo item'),
  completed: z
    .boolean()
    .default(false)
    .describe('Whether the todo item is completed'),
});

export type TodoItem = z.infer<typeof TodoItemSchema>;

export const TodoListAgentResponseSchema = z.object({
  items: z.array(TodoItemSchema).describe('Array of todo items'),
});

export type TodoListAgentResponse = z.infer<typeof TodoListAgentResponseSchema>;

export const OnStepSchema = z.object({
  title: z.string(),
  type: z.enum(['error', 'info', 'success']),
  error: z.instanceof(Error).nullable(),
  toolDiscovery: DiscoverySchema.nullable(),
  suggestion: SuggestionSchema.nullable(),
  workflow: z.any().nullable(),
  todoList: z
    .object({
      items: z.array(TodoItemSchema),
      completedCount: z.number(),
      totalCount: z.number(),
    })
    .nullable(),
});

export type OnStep = z.infer<typeof OnStepSchema>;
