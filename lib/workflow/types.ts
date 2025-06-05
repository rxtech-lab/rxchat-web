import { z } from 'zod';

const BaseNode = z.object({
  identifier: z.string(),
  data: z.record(z.string(), z.any()),
});

export const NodeSchema = BaseNode.extend({
  parentNode: BaseNode.optional(),
  children: z.array(BaseNode),
});

export const ToolNodeSchema = BaseNode.extend({
  type: z.literal('tool'),
  tool: z.string(),
});

export const InputNodeSchema = BaseNode.extend({
  type: z.literal('input'),
});

export const CrojobInputNodeSchema = BaseNode.extend({
  type: z.literal('crojob-input'),
  /**
   * Cron time for crojob, must match standard cron syntax:
   * minute hour day month weekday (e.g. "0 0 * * *")
   */
  cron: z
    .string()
    .regex(
      /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([01]?\d|2[0-9]|3[01])) (\*|(1[0-2]|0?[1-9])) (\*|([0-6]))$/,
      'Must be a valid cron expression (minute hour day month weekday)',
    )
    .describe('cron time for crojob, e.g. "0 0 * * *"'),
});

export const ConversionNodeSchema = BaseNode.extend({
  type: z.literal('conversion'),
  conversion: z.string(),
});

export const WorkflowSchema = z.object({
  title: z.string(),
  entryNode: NodeSchema,
});
