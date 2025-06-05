'use client';

import React from 'react';
import { WorkflowView } from './workflow-view';
import type { Workflow } from './types';

// Sample workflow data for demonstration
const sampleWorkflow: Workflow = {
  title: 'Daily Data Processing Pipeline',
  trigger: {
    identifier: 'daily-trigger',
    type: 'cronjob-trigger',
    cron: '0 2 * * *', // Daily at 2 AM
    child: {
      identifier: 'data-extraction',
      type: 'tool',
      toolIdentifier: 'data-extractor',
      child: {
        identifier: 'data-validator',
        type: 'condition',
        runtime: 'js',
        children: [
          {
            identifier: 'data-validator-success',
            type: 'tool',
            toolIdentifier: 'data-validator-success',
          },
        ],
        code: 'return input.map(item => ({ ...item, processed: true }));',
      },
    },
  },
};

export function WorkflowExample() {
  return (
    <div className="w-full h-screen">
      <WorkflowView workflow={sampleWorkflow} />
    </div>
  );
}

export default WorkflowExample;
