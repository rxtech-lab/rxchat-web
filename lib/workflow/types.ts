import { z } from 'zod';
import { isValidCron } from 'cron-validator';

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
   * Can be a ToolNode, ConverterNode, or ConditionNode, or undefined.
   */
  child: z
    .union([
      z.lazy((): any => ToolNodeSchema),
      z.lazy((): any => ConverterNodeSchema),
      z.lazy((): any => ConditionNodeSchema),
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
        z.union([ToolNodeSchema, ConverterNodeSchema, ConditionNodeSchema]),
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
        z.union([ToolNodeSchema, ConverterNodeSchema, ConditionNodeSchema]),
      ),
    )
    .describe('children nodes of the current node'),
  code: z.string().describe('JavaScript code to execute for this condition'),
}).strict();

export type ConditionNode = z.infer<typeof ConditionNodeSchema>;

/**
 * Tool node can only have one parent and one child
 */
export const ToolNodeSchema = RegularNodeSchema.extend({
  type: z.literal('tool'),
  toolIdentifier: z.string().describe('identifier of the tool to execute'),
  inputSchema: z.any().describe('input schema of the tool'),
  outputSchema: z.any().describe('output schema of the tool'),
}).strict();

export type ToolNode = z.infer<typeof ToolNodeSchema>;

/**
 * Converter node can only have one parent and one child
 */
export const ConverterNodeSchema = RegularNodeSchema.extend({
  type: z.literal('converter'),
  converter: z.string(),
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
      z.union([ToolNodeSchema, ConverterNodeSchema, ConditionNodeSchema]),
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

export const ConversionNodeSchema = BaseNodeSchema.extend({
  type: z.literal('conversion'),
  conversion: z.string(),
});

export type ConversionNode = z.infer<typeof ConversionNodeSchema>;

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

export const ConverterNodeExecutionResultSchema = z
  .any()
  .describe(
    "The output that converts from the input node and matches the child's input schema",
  );

export type ConverterNodeExecutionResult = z.infer<
  typeof ConverterNodeExecutionResultSchema
>;
