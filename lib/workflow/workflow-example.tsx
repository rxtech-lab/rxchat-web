'use client';

import React from 'react';
import { WorkflowView } from './workflow-view';
import type {
  Workflow,
  ToolNode,
  ConverterNode,
  ConditionalNode,
} from './types';

// Sample workflow data for demonstration using proper types from types.ts
export const sampleWorkflow: Workflow = {
  title: 'Daily Data Processing Pipeline',
  trigger: {
    identifier: 'a1b2c3d4-e5f6-4789-9abc-123456789def',
    type: 'cronjob-trigger',
    cron: '0 2 * * *', // Daily at 2 AM
    child: {
      identifier: 'b2c3d4e5-f6a7-4890-abcd-23456789def0',
      type: 'tool',
      toolIdentifier: 'data-extractor',
      child: {
        identifier: 'c3d4e5f6-a7b8-4901-bcde-3456789def01',
        type: 'converter',
        converter: 'data-processor',
        runtime: 'js',
        code: 'return input.map(item => ({ ...item, processed: true }));',
        child: {
          identifier: 'd4e5f6a7-b8c9-4012-cdef-456789def012',
          type: 'tool',
          toolIdentifier: 'data-validator-success',
          child: {
            identifier: 'conditional-1',
            type: 'conditional',
            condition: 'data-validator-success',
            children: [
              {
                identifier: 'conditional-1-true',
                type: 'tool',
                toolIdentifier: 'data-validator-success',
              } as ToolNode,
              {
                identifier: 'conditional-1-false',
                type: 'tool',
                toolIdentifier: 'data-validator-success',
              } as ToolNode,
            ],
          } as ConditionalNode,
        } as ToolNode,
      } as ConverterNode,
    } as ToolNode,
  },
};
