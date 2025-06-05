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
            identifier: '550e8400-e29b-41d4-a716-446655440001',
            type: 'cronjob-trigger',
            cron: '0 0 * * *',
            child: {
              identifier: '550e8400-e29b-41d4-a716-446655440002',
            },
          },
        },
        isValid: true,
        description: 'valid workflow with cronjob trigger',
      },
      {
        workflow: {
          trigger: {
            identifier: '550e8400-e29b-41d4-a716-446655440001',
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
            identifier: '550e8400-e29b-41d4-a716-446655440001',
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
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '0 0 * * *', // daily at midnight
        },
        isValid: true,
        description: 'valid daily cron without child',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: {
            identifier: '550e8400-e29b-41d4-a716-446655440002',
          },
        },
        isValid: true,
        description: 'valid daily cron with child',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '30 14 * * 1', // every Monday at 2:30 PM
        },
        isValid: true,
        description: 'valid weekly cron',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '*/15 * * * *', // every 15 minutes
        },
        isValid: true,
        description: 'valid interval cron',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '60 0 * * *', // invalid minute (60)
        },
        isValid: false,
        description: 'invalid minute value',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '0 25 * * *', // invalid hour (25)
        },
        isValid: false,
        description: 'invalid hour value',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '0 0 32 * *', // invalid day (32)
        },
        isValid: false,
        description: 'invalid day value',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '0 0 * 13 *', // invalid month (13)
        },
        isValid: false,
        description: 'invalid month value',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '0 0 * * 7', // invalid weekday (7)
        },
        isValid: false,
        description: 'invalid weekday value',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
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
      {
        trigger: {
          identifier: 'invalid-uuid',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
        },
        isValid: false,
        description: 'invalid UUID identifier',
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
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'tool',
          toolIdentifier: 'send-email',
        },
        isValid: true,
        description: 'valid tool node without child',
      },
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'tool',
          toolIdentifier: 'send-email',
          child: {
            identifier: '550e8400-e29b-41d4-a716-446655440002',
            type: 'tool',
            toolIdentifier: 'another-tool',
          },
        },
        isValid: true,
        description: 'valid tool node with child',
      },
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'tool',
        },
        isValid: false,
        description: 'missing toolIdentifier field',
      },
      {
        node: {
          type: 'tool',
          toolIdentifier: 'send-email',
        },
        isValid: false,
        description: 'missing identifier',
      },
      {
        node: {
          identifier: 'invalid-uuid',
          type: 'tool',
          toolIdentifier: 'send-email',
        },
        isValid: false,
        description: 'invalid UUID identifier',
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
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'condition',
          runtime: 'js',
          code: 'return input.status === "active";',
          children: [],
        },
        isValid: true,
        description: 'valid condition node with empty children',
      },
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'condition',
          runtime: 'js',
          code: 'return input.status === "active";',
          children: [
            {
              identifier: '550e8400-e29b-41d4-a716-446655440002',
            },
            {
              identifier: '550e8400-e29b-41d4-a716-446655440003',
            },
          ],
        },
        isValid: true,
        description: 'valid condition node with multiple children',
      },
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'condition',
          children: [],
        },
        isValid: false,
        description: 'missing runtime and code',
      },
      {
        node: {
          identifier: 'invalid-uuid',
          type: 'condition',
          runtime: 'js',
          code: 'return true;',
          children: [],
        },
        isValid: false,
        description: 'invalid UUID identifier',
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
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'converter',
          converter: 'json-to-csv',
          runtime: 'js',
          code: 'return convertJsonToCsv(input);',
        },
        isValid: true,
        description: 'valid converter node without child',
      },
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'converter',
          converter: 'json-to-csv',
          runtime: 'js',
          code: 'return convertJsonToCsv(input);',
          child: {
            identifier: '550e8400-e29b-41d4-a716-446655440002',
            type: 'tool',
            toolIdentifier: 'test-tool',
          },
        },
        isValid: true,
        description: 'valid converter node with child',
      },
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'converter',
          converter: 'json-to-csv',
        },
        isValid: false,
        description: 'missing runtime and code',
      },
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'converter',
          runtime: 'js',
          code: 'return input;',
        },
        isValid: false,
        description: 'missing converter field',
      },
      {
        node: {
          identifier: 'invalid-uuid',
          type: 'converter',
          converter: 'json-to-csv',
          runtime: 'js',
          code: 'return input;',
        },
        isValid: false,
        description: 'invalid UUID identifier',
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
    it('should validate that tool nodes can only have one child', () => {
      const validToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440001',
        type: 'tool',
        toolIdentifier: 'test-tool',
        child: {
          identifier: '550e8400-e29b-41d4-a716-446655440002',
          type: 'tool',
          toolIdentifier: 'child-tool',
        },
      };

      expect(() => ToolNodeSchema.parse(validToolNode)).not.toThrow();

      // Should not accept parent property (ToolNodeSchema extends RegularNodeSchema which only has child)
      const invalidToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440001',
        type: 'tool',
        toolIdentifier: 'test-tool',
        parent: { identifier: '550e8400-e29b-41d4-a716-446655440002' },
      };

      // This should fail because the schema doesn't have parent property
      expect(() => ToolNodeSchema.parse(invalidToolNode)).toThrow();
    });

    it('should validate that condition nodes can have multiple children', () => {
      const validConditionNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440001',
        type: 'condition',
        runtime: 'js',
        code: 'return true;',
        children: [
          {
            identifier: '550e8400-e29b-41d4-a716-446655440002',
          },
          {
            identifier: '550e8400-e29b-41d4-a716-446655440003',
          },
        ],
      };

      expect(() => ConditionNodeSchema.parse(validConditionNode)).not.toThrow();
    });

    it('should validate that trigger nodes can only have one child and no parents', () => {
      const validTriggerNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440001',
        type: 'cronjob-trigger',
        cron: '0 0 * * *',
        child: {
          identifier: '550e8400-e29b-41d4-a716-446655440002',
        },
      };

      expect(() =>
        CronjobTriggerNodeSchema.parse(validTriggerNode),
      ).not.toThrow();

      // Should not accept parent property (TriggerNodeSchema doesn't have parent property)
      const invalidTriggerNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440001',
        type: 'cronjob-trigger',
        cron: '0 0 * * *',
        parent: { identifier: '550e8400-e29b-41d4-a716-446655440002' },
        child: { identifier: '550e8400-e29b-41d4-a716-446655440003' },
      };

      // This should fail because trigger schema doesn't have parent property
      expect(() =>
        CronjobTriggerNodeSchema.parse(invalidTriggerNode),
      ).toThrow();
    });
  });
});
