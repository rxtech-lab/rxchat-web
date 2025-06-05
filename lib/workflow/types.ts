import { z } from 'zod';
import { isValidCron } from 'cron-validator';

const BaseNodeSchema = z.object({
  identifier: z.string().describe("unique tool's identifier"),
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
export const RegularNodeSchema = BaseNodeSchema.extend({
  parent: BaseNodeSchema.optional().describe('parent node of the current node'),
  child: BaseNodeSchema.optional().describe('child node of the current node'),
}).strict();

export type RegularNode = z.infer<typeof RegularNodeSchema>;

// Schema for conditional nodes that can have multiple parents and children
export const ConditionalNodeSchema = BaseNodeSchema.extend({
  parents: z.array(BaseNodeSchema).describe('parent nodes of the current node'),
  children: z
    .array(BaseNodeSchema)
    .describe('children nodes of the current node'),
}).strict();

export type ConditionalNode = z.infer<typeof ConditionalNodeSchema>;

// Legacy Node schema for backward compatibility (deprecated)
export const NodeSchema = BaseNodeSchema.extend({
  parents: z.array(BaseNodeSchema).describe('parent nodes of the current node'),
  children: z
    .array(BaseNodeSchema)
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
  code: z.string().describe('JavaScript code to execute for this condition'),
}).strict();

export type ConditionNode = z.infer<typeof ConditionNodeSchema>;

/**
 * Tool node can only have one parent and one child
 */
export const ToolNodeSchema = RegularNodeSchema.extend({
  type: z.literal('tool'),
  tool: z.string(),
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
  child: BaseNodeSchema.optional().describe('child node of the trigger'),
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
