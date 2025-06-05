import {
  WorkflowSchema,
  CronjobTriggerNodeSchema,
  ToolNodeSchema,
  ConditionNodeSchema,
  ConverterNodeSchema,
  RuntimeCodeSchema,
} from './types';

describe('Schema validation', () => {
  describe('WorkflowSchema', () => {
    const testCases: {
      workflow: any;
      isValid: boolean;
      description: string;
    }[] = [
      {
        workflow: {
          title: 'Test Workflow',
          trigger: {
            identifier: 'daily-trigger',
            type: 'cronjob-trigger',
            cron: '0 0 * * *',
            child: {
              identifier: 'next-node',
            },
          },
        },
        isValid: true,
        description: 'valid workflow with cronjob trigger',
      },
      {
        workflow: {
          trigger: {
            identifier: 'daily-trigger',
            type: 'cronjob-trigger',
            cron: '0 0 * * *',
          },
        },
        isValid: false,
        description: 'missing title',
      },
      {
        workflow: {
          title: 'Test Workflow',
        },
        isValid: false,
        description: 'missing trigger',
      },
      {
        workflow: {
          title: '',
          trigger: {
            identifier: 'daily-trigger',
            type: 'cronjob-trigger',
            cron: '0 0 * * *',
          },
        },
        isValid: false,
        description: 'empty title',
      },
    ];

    testCases.forEach(({ workflow, isValid, description }) => {
      it(`should ${isValid ? 'validate' : 'invalidate'} ${description}`, () => {
        if (isValid) {
          expect(() => WorkflowSchema.parse(workflow)).not.toThrow();
        } else {
          expect(() => WorkflowSchema.parse(workflow)).toThrow();
        }
      });
    });
  });

  describe('CronjobTriggerNodeSchema', () => {
    const cronTestCases: {
      trigger: any;
      isValid: boolean;
      description: string;
    }[] = [
      {
        trigger: {
          identifier: 'valid-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *', // daily at midnight
        },
        isValid: true,
        description: 'valid daily cron without child',
      },
      {
        trigger: {
          identifier: 'valid-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: {
            identifier: 'next-node',
          },
        },
        isValid: true,
        description: 'valid daily cron with child',
      },
      {
        trigger: {
          identifier: 'valid-trigger',
          type: 'cronjob-trigger',
          cron: '30 14 * * 1', // every Monday at 2:30 PM
        },
        isValid: true,
        description: 'valid weekly cron',
      },
      {
        trigger: {
          identifier: 'valid-trigger',
          type: 'cronjob-trigger',
          cron: '*/15 * * * *', // every 15 minutes
        },
        isValid: true,
        description: 'valid interval cron',
      },
      {
        trigger: {
          identifier: 'invalid-trigger',
          type: 'cronjob-trigger',
          cron: '60 0 * * *', // invalid minute (60)
        },
        isValid: false,
        description: 'invalid minute value',
      },
      {
        trigger: {
          identifier: 'invalid-trigger',
          type: 'cronjob-trigger',
          cron: '0 25 * * *', // invalid hour (25)
        },
        isValid: false,
        description: 'invalid hour value',
      },
      {
        trigger: {
          identifier: 'invalid-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 32 * *', // invalid day (32)
        },
        isValid: false,
        description: 'invalid day value',
      },
      {
        trigger: {
          identifier: 'invalid-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * 13 *', // invalid month (13)
        },
        isValid: false,
        description: 'invalid month value',
      },
      {
        trigger: {
          identifier: 'invalid-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * 7', // invalid weekday (7)
        },
        isValid: false,
        description: 'invalid weekday value',
      },
      {
        trigger: {
          identifier: 'missing-cron',
          type: 'cronjob-trigger',
        },
        isValid: false,
        description: 'missing cron field',
      },
      {
        trigger: {
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
        },
        isValid: false,
        description: 'missing identifier',
      },
    ];

    cronTestCases.forEach(({ trigger, isValid, description }) => {
      it(`should ${isValid ? 'validate' : 'invalidate'} ${description}`, () => {
        if (isValid) {
          expect(() => CronjobTriggerNodeSchema.parse(trigger)).not.toThrow();
        } else {
          expect(() => CronjobTriggerNodeSchema.parse(trigger)).toThrow();
        }
      });
    });
  });

  describe('ToolNodeSchema', () => {
    const toolTestCases: {
      node: any;
      isValid: boolean;
      description: string;
    }[] = [
      {
        node: {
          identifier: 'email-tool',
          type: 'tool',
          tool: 'send-email',
        },
        isValid: true,
        description: 'valid tool node without parent/child',
      },
      {
        node: {
          identifier: 'email-tool',
          type: 'tool',
          tool: 'send-email',
          parent: {
            identifier: 'parent-node',
          },
          child: {
            identifier: 'child-node',
          },
        },
        isValid: true,
        description: 'valid tool node with parent and child',
      },
      {
        node: {
          identifier: 'email-tool',
          type: 'tool',
          tool: 'send-email',
          parent: {
            identifier: 'parent-node',
          },
        },
        isValid: true,
        description: 'valid tool node with only parent',
      },
      {
        node: {
          identifier: 'invalid-tool',
          type: 'tool',
        },
        isValid: false,
        description: 'missing tool field',
      },
      {
        node: {
          type: 'tool',
          tool: 'send-email',
        },
        isValid: false,
        description: 'missing identifier',
      },
    ];

    toolTestCases.forEach(({ node, isValid, description }) => {
      it(`should ${isValid ? 'validate' : 'invalidate'} ${description}`, () => {
        if (isValid) {
          expect(() => ToolNodeSchema.parse(node)).not.toThrow();
        } else {
          expect(() => ToolNodeSchema.parse(node)).toThrow();
        }
      });
    });
  });

  describe('ConditionNodeSchema', () => {
    const conditionTestCases: {
      node: any;
      isValid: boolean;
      description: string;
    }[] = [
      {
        node: {
          identifier: 'check-status',
          type: 'condition',
          runtime: 'js',
          code: 'return input.status === "active";',
          parents: [],
          children: [],
        },
        isValid: true,
        description: 'valid condition node with empty parents/children',
      },
      {
        node: {
          identifier: 'check-status',
          type: 'condition',
          runtime: 'js',
          code: 'return input.status === "active";',
          parents: [{ identifier: 'parent1' }, { identifier: 'parent2' }],
          children: [{ identifier: 'child1' }, { identifier: 'child2' }],
        },
        isValid: true,
        description: 'valid condition node with multiple parents and children',
      },
      {
        node: {
          identifier: 'invalid-condition',
          type: 'condition',
          parents: [],
          children: [],
        },
        isValid: false,
        description: 'missing runtime code',
      },
    ];

    conditionTestCases.forEach(({ node, isValid, description }) => {
      it(`should ${isValid ? 'validate' : 'invalidate'} ${description}`, () => {
        if (isValid) {
          expect(() => ConditionNodeSchema.parse(node)).not.toThrow();
        } else {
          expect(() => ConditionNodeSchema.parse(node)).toThrow();
        }
      });
    });
  });

  describe('ConverterNodeSchema', () => {
    const converterTestCases: {
      node: any;
      isValid: boolean;
      description: string;
    }[] = [
      {
        node: {
          identifier: 'data-converter',
          type: 'converter',
          converter: 'json-to-csv',
          runtime: 'js',
          code: 'return convertJsonToCsv(input);',
        },
        isValid: true,
        description: 'valid converter node without parent/child',
      },
      {
        node: {
          identifier: 'data-converter',
          type: 'converter',
          converter: 'json-to-csv',
          runtime: 'js',
          code: 'return convertJsonToCsv(input);',
          parent: {
            identifier: 'parent-node',
          },
          child: {
            identifier: 'child-node',
          },
        },
        isValid: true,
        description: 'valid converter node with parent and child',
      },
      {
        node: {
          identifier: 'invalid-converter',
          type: 'converter',
          converter: 'json-to-csv',
        },
        isValid: false,
        description: 'missing runtime code',
      },
      {
        node: {
          identifier: 'invalid-converter',
          type: 'converter',
          runtime: 'js',
          code: 'return input;',
        },
        isValid: false,
        description: 'missing converter field',
      },
    ];

    converterTestCases.forEach(({ node, isValid, description }) => {
      it(`should ${isValid ? 'validate' : 'invalidate'} ${description}`, () => {
        if (isValid) {
          expect(() => ConverterNodeSchema.parse(node)).not.toThrow();
        } else {
          expect(() => ConverterNodeSchema.parse(node)).toThrow();
        }
      });
    });
  });

  describe('RuntimeCodeSchema', () => {
    const runtimeTestCases: {
      runtime: any;
      isValid: boolean;
      description: string;
    }[] = [
      {
        runtime: {
          runtime: 'js',
          code: 'return true;',
        },
        isValid: true,
        description: 'valid js runtime',
      },
      {
        runtime: {
          runtime: 'python',
          code: 'return True',
        },
        isValid: false,
        description: 'unsupported runtime type',
      },
      {
        runtime: {
          runtime: 'js',
        },
        isValid: false,
        description: 'missing code field',
      },
      {
        runtime: {
          code: 'return true;',
        },
        isValid: false,
        description: 'missing runtime field',
      },
    ];

    runtimeTestCases.forEach(({ runtime, isValid, description }) => {
      it(`should ${isValid ? 'validate' : 'invalidate'} ${description}`, () => {
        if (isValid) {
          expect(() => RuntimeCodeSchema.parse(runtime)).not.toThrow();
        } else {
          expect(() => RuntimeCodeSchema.parse(runtime)).toThrow();
        }
      });
    });
  });

  describe('Node Relationship Constraints', () => {
    it('should validate that tool nodes can only have one parent and one child', () => {
      const validToolNode = {
        identifier: 'single-tool',
        type: 'tool',
        tool: 'test-tool',
        parent: { identifier: 'parent' },
        child: { identifier: 'child' },
      };

      expect(() => ToolNodeSchema.parse(validToolNode)).not.toThrow();

      // Should not accept arrays (this would fail at TypeScript level)
      const invalidToolNode = {
        identifier: 'multi-tool',
        type: 'tool',
        tool: 'test-tool',
        parents: [{ identifier: 'parent1' }, { identifier: 'parent2' }],
        children: [{ identifier: 'child1' }, { identifier: 'child2' }],
      };

      // This should fail because the schema doesn't have parents/children properties
      expect(() => ToolNodeSchema.parse(invalidToolNode)).toThrow();
    });

    it('should validate that condition nodes can have multiple parents and children', () => {
      const validConditionNode = {
        identifier: 'multi-condition',
        type: 'condition',
        runtime: 'js',
        code: 'return true;',
        parents: [{ identifier: 'parent1' }, { identifier: 'parent2' }],
        children: [{ identifier: 'child1' }, { identifier: 'child2' }],
      };

      expect(() => ConditionNodeSchema.parse(validConditionNode)).not.toThrow();
    });

    it('should validate that trigger nodes can only have one child and no parents', () => {
      const validTriggerNode = {
        identifier: 'single-trigger',
        type: 'cronjob-trigger',
        cron: '0 0 * * *',
        child: { identifier: 'child' },
      };

      expect(() =>
        CronjobTriggerNodeSchema.parse(validTriggerNode),
      ).not.toThrow();

      // Should not accept parent property (this would fail at TypeScript level)
      const invalidTriggerNode = {
        identifier: 'invalid-trigger',
        type: 'cronjob-trigger',
        cron: '0 0 * * *',
        parent: { identifier: 'parent' },
        child: { identifier: 'child' },
      };

      // This should fail because trigger schema doesn't have parent property
      expect(() =>
        CronjobTriggerNodeSchema.parse(invalidTriggerNode),
      ).toThrow();
    });
  });
});
