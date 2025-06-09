import type { CronjobTriggerNode, ToolNode } from './types';
import { Workflow } from './workflow';

describe('Workflow', () => {
  let workflow: Workflow;
  const mockTrigger: CronjobTriggerNode = {
    identifier: '550e8400-e29b-41d4-a716-446655440000',
    type: 'cronjob-trigger',
    cron: '0 2 * * *',
    child: null,
  };

  beforeEach(() => {
    workflow = new Workflow('Test Workflow', mockTrigger);
  });

  describe('Constructor', () => {
    it('should create a workflow with title and trigger', () => {
      expect(workflow.getTitle()).toBe('Test Workflow');
      expect(workflow.getTrigger()).toEqual(mockTrigger);
      expect(workflow.getWorkflow()).toEqual({
        title: 'Test Workflow',
        trigger: mockTrigger,
      });
    });
  });

  describe('addChild', () => {
    it('should be able to add a child node to the trigger when identifier is undefined', () => {
      const childNode: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440001',
        type: 'tool',
        toolIdentifier: 'test-tool',
        child: null,
      };

      workflow.addChild(undefined, childNode);
      expect(workflow.getWorkflow().trigger.child).toEqual(childNode);
    });

    it('should be able to add a child node to a specific parent', () => {
      const parentNode: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440002',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
      };

      const childNode: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440003',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
      };

      workflow.addChild(undefined, parentNode);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440002', childNode);

      const workflowData = workflow.getWorkflow();
      expect((workflowData.trigger.child as ToolNode).child).toEqual(childNode);
    });

    it('should throw error when parent node is not found', () => {
      const childNode: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440004',
        type: 'tool',
        toolIdentifier: 'test-tool',
        child: null,
      };

      expect(() => {
        workflow.addChild('550e8400-e29b-41d4-a716-446655440999', childNode);
      }).toThrow(
        'Node with identifier 550e8400-e29b-41d4-a716-446655440999 not found',
      );
    });

    it('should throw error when parent node already has a child', () => {
      const parentNode: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440005',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: {
          identifier: '550e8400-e29b-41d4-a716-446655440006',
          type: 'tool',
          toolIdentifier: 'existing-tool',
          child: null,
        } as ToolNode,
      };

      const newChildNode: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440007',
        type: 'tool',
        toolIdentifier: 'new-tool',
        child: null,
      };

      workflow.addChild(undefined, parentNode);

      expect(() => {
        workflow.addChild('550e8400-e29b-41d4-a716-446655440005', newChildNode);
      }).toThrow(
        "Node with identifier 550e8400-e29b-41d4-a716-446655440005 already has a child or doesn't support children",
      );
    });
  });

  describe('removeChild', () => {
    it('should remove a child node from the workflow', () => {
      const childNode: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440008',
        type: 'tool',
        toolIdentifier: 'test-tool',
        child: null,
      };

      workflow.addChild(undefined, childNode);
      expect(workflow.getWorkflow().trigger.child).toEqual(childNode);

      workflow.removeChild('550e8400-e29b-41d4-a716-446655440008');
      expect(workflow.getWorkflow().trigger.child).toBeNull();
    });

    it('should throw error when trying to remove non-existent node', () => {
      expect(() => {
        workflow.removeChild('550e8400-e29b-41d4-a716-446655440999');
      }).toThrow(
        'Node with identifier 550e8400-e29b-41d4-a716-446655440999 not found',
      );
    });

    it('should throw error when trying to remove root trigger node', () => {
      expect(() => {
        workflow.removeChild('550e8400-e29b-41d4-a716-446655440000');
      }).toThrow('Cannot remove root trigger node');
    });
  });

  describe('modifyChild', () => {
    it('should modify an existing child node', () => {
      const originalChild: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440009',
        type: 'tool',
        toolIdentifier: 'original-tool',
        child: null,
      };

      const modifiedChild: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440009',
        type: 'tool',
        toolIdentifier: 'modified-tool',
        child: null,
      };

      workflow.addChild(undefined, originalChild);
      workflow.modifyChild(
        '550e8400-e29b-41d4-a716-446655440009',
        modifiedChild,
      );

      expect(workflow.getWorkflow().trigger.child).toEqual(modifiedChild);
    });

    it('should throw error when trying to modify non-existent node', () => {
      const childNode: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440010',
        type: 'tool',
        toolIdentifier: 'test-tool',
        child: null,
      };

      expect(() => {
        workflow.modifyChild('550e8400-e29b-41d4-a716-446655440999', childNode);
      }).toThrow(
        'Node with identifier 550e8400-e29b-41d4-a716-446655440999 not found',
      );
    });

    it('should throw error when trying to modify root trigger node', () => {
      const childNode: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440000',
        type: 'tool',
        toolIdentifier: 'test-tool',
        child: null,
      };

      expect(() => {
        workflow.modifyChild('550e8400-e29b-41d4-a716-446655440000', childNode);
      }).toThrow('Cannot modify root trigger node');
    });
  });

  describe('compile', () => {
    it('should validate and return workflow when valid', () => {
      // Test with a fresh workflow that has no children added
      const freshTrigger: CronjobTriggerNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440100',
        type: 'cronjob-trigger',
        cron: '0 2 * * *',
        child: null,
      };
      const freshWorkflow = new Workflow('Test Workflow', freshTrigger);
      const result = freshWorkflow.compile();
      expect(result).toEqual({
        title: 'Test Workflow',
        trigger: freshTrigger,
      });
    });

    it('should throw error when workflow is invalid', () => {
      // Create workflow with invalid trigger (empty title)
      const freshTrigger: CronjobTriggerNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440101',
        type: 'cronjob-trigger',
        cron: '0 2 * * *',
        child: null,
      };
      const invalidWorkflow = new Workflow('', freshTrigger);

      expect(() => {
        invalidWorkflow.compile();
      }).toThrow('Workflow validation failed:');
    });

    it('should pass compilation with compatible tool nodes', () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440200',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
      };

      const child: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440201',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440200', child);

      expect(() => {
        workflow.compile();
      }).not.toThrow();
    });

    it('should fail compilation with incompatible tool nodes (property mismatch)', () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440202',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
      };

      const child: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440203',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
          },
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440202', child);

      expect(() => {
        workflow.compile();
      }).toThrow(
        /Workflow compilation failed due to input\/output compatibility issues/,
      );
    });

    it('should fail compilation with incompatible tool nodes (type mismatch)', () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440204',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            age: { type: 'number' },
          },
        },
      };

      const child: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440205',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            age: { type: 'string' },
          },
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440204', child);

      expect(() => {
        const result = workflow.compile();
      }).toThrow(
        /Property '550e8400-e29b-41d4-a716-446655440205\.age' expects type 'string' but parent outputs type 'number'/,
      );
    });

    it('should fail compilation with multiple compatibility issues', () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440206',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            firstName: { type: 'string' },
            age: { type: 'number' },
          },
        },
      };

      const child: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440207',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            name: { type: 'string' },
            age: { type: 'string' },
            email: { type: 'string' },
          },
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440206', child);

      expect(() => {
        workflow.compile();
      }).toThrow(
        /Workflow compilation failed due to input\/output compatibility issues/,
      );
    });

    it('should pass compilation when parent outputs extra properties', () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440208',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
            email: { type: 'string' },
            phone: { type: 'string' },
          },
        },
      };

      const child: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440209',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440208', child);

      expect(() => {
        workflow.compile();
      }).not.toThrow();
    });

    it('should fail compilation when parent has no output but child expects input', () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440210',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {},
        },
      };

      const child: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440211',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            name: { type: 'string' },
          },
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440210', child);

      expect(() => {
        workflow.compile();
      }).toThrow(
        /Child node 550e8400-e29b-41d4-a716-446655440211 expects input properties but parent node 550e8400-e29b-41d4-a716-446655440210 has no output properties/,
      );
    });

    it('should pass compilation with nodes that have no schemas', () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440212',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: undefined,
        outputSchema: undefined,
      };

      const child: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440213',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: undefined,
        outputSchema: undefined,
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440212', child);

      expect(() => {
        workflow.compile();
      }).not.toThrow();
    });

    it('should pass compilation when child has no input requirements', () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440214',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            name: { type: 'string' },
          },
        },
      };

      const child: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440215',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {},
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440214', child);

      expect(() => {
        workflow.compile();
      }).not.toThrow();
    });

    it('should pass compilation with complex nested object compatibility', () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440216',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' },
                address: {
                  type: 'object',
                  properties: {
                    street: { type: 'string' },
                    city: { type: 'string' },
                    zipCode: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      };

      const child: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440217',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' },
                address: {
                  type: 'object',
                  properties: {
                    street: { type: 'string' },
                    city: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440216', child);

      expect(() => {
        workflow.compile();
      }).not.toThrow();
    });

    it('should fail compilation with nested object incompatibility', () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440218',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const child: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440219',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' },
                email: { type: 'string' },
              },
            },
          },
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440218', child);

      expect(() => {
        workflow.compile();
      }).toThrow(
        /Nested object '550e8400-e29b-41d4-a716-446655440219\.user' expects properties \[age, email\]/,
      );
    });

    it('should pass compilation with array schemas', () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440220',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      };

      const child: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440221',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440220', child);

      expect(() => {
        workflow.compile();
      }).not.toThrow();
    });

    it('should fail compilation with array item type mismatch', () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440222',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            numbers: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      };

      const child: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440223',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            numbers: {
              type: 'array',
              items: { type: 'number' },
            },
          },
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440222', child);

      expect(() => {
        workflow.compile();
      }).toThrow(
        /Property '550e8400-e29b-41d4-a716-446655440223\.numbers\[items\]' expects type 'number' but parent outputs type 'string'/,
      );
    });

    it('should handle workflow with chained tool nodes', () => {
      const first: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440224',
        type: 'tool',
        toolIdentifier: 'first-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            data: { type: 'string' },
          },
        },
      };

      const second: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440225',
        type: 'tool',
        toolIdentifier: 'second-tool',
        child: null,
        inputSchema: {
          properties: {
            data: { type: 'string' },
          },
        },
        outputSchema: {
          properties: {
            processedData: { type: 'string' },
          },
        },
      };

      const third: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440226',
        type: 'tool',
        toolIdentifier: 'third-tool',
        child: null,
        inputSchema: {
          properties: {
            processedData: { type: 'string' },
          },
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, first);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440224', second);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440225', third);

      expect(() => {
        workflow.compile();
      }).not.toThrow();
    });

    it('should detect incompatibility in a chain of tool nodes', () => {
      const first: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440227',
        type: 'tool',
        toolIdentifier: 'first-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            data: { type: 'string' },
          },
        },
      };

      const second: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440228',
        type: 'tool',
        toolIdentifier: 'second-tool',
        child: null,
        inputSchema: {
          properties: {
            data: { type: 'string' },
          },
        },
        outputSchema: {
          properties: {
            result: { type: 'number' },
          },
        },
      };

      const third: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440229',
        type: 'tool',
        toolIdentifier: 'third-tool',
        child: null,
        inputSchema: {
          properties: {
            result: { type: 'string' }, // Type mismatch - expects string but gets number
          },
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, first);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440227', second);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440228', third);

      expect(() => {
        workflow.compile();
      }).toThrow(
        /Property '550e8400-e29b-41d4-a716-446655440229\.result' expects type 'string' but parent outputs type 'number'/,
      );
    });
  });

  describe('readFrom', () => {
    it('should construct workflow from valid JSON object', () => {
      const workflowData = {
        title: 'Imported Workflow',
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440011',
          type: 'cronjob-trigger' as const,
          cron: '0 0 * * *',
          child: null,
        },
      };

      workflow.readFrom(workflowData);
      expect(workflow.getWorkflow()).toEqual(workflowData);
    });

    it('should throw error when JSON object is invalid', () => {
      const invalidWorkflowData = {
        title: '',
        trigger: null,
      };

      expect(() => {
        workflow.readFrom(invalidWorkflowData as any);
      }).toThrow('Invalid workflow format:');
    });
  });

  describe('Getters', () => {
    it('should return correct workflow data', () => {
      const workflowData = workflow.getWorkflow();
      expect(workflowData.title).toBe('Test Workflow');
      expect(workflowData.trigger).toEqual(mockTrigger);
    });

    it('should return correct title', () => {
      expect(workflow.getTitle()).toBe('Test Workflow');
    });

    it('should return correct trigger', () => {
      expect(workflow.getTrigger()).toEqual(mockTrigger);
    });
  });

  describe('checkInputAndOutputFit', () => {
    it('should detect property name mismatch', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            name: { type: 'string' },
          },
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            firstName: { type: 'string' },
          },
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(false);
      expect(result.error).toContain(
        'Child node child-1 expects properties [firstName] but parent node parent-1 outputs [name]',
      );
      expect(result.suggestion).toContain(
        "Consider mapping 'name' to 'firstName'",
      );
    });

    it('should detect type mismatch', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            age: { type: 'number' },
          },
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            age: { type: 'string' },
          },
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(false);
      expect(result.error).toContain(
        "Property 'child-1.age' expects type 'string' but parent outputs type 'number'",
      );
      expect(result.suggestion).toContain(
        "Ensure type compatibility for property 'child-1.age'",
      );
    });

    it('should detect multiple property mismatches', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            age: { type: 'number' },
          },
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            name: { type: 'string' },
            age: { type: 'string' },
            email: { type: 'string' },
          },
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(false);
      expect(result.error).toContain('expects properties [name, email]');
      expect(result.error).toContain(
        "Property 'child-1.age' expects type 'string' but parent outputs type 'number'",
      );
    });

    it('should pass with perfect schema match', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(true);
      expect(result.error).toBe('');
      expect(result.suggestion).toBe('Schema compatibility is perfect');
    });

    it('should handle parent with extra properties', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
            email: { type: 'string' },
          },
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(true);
      expect(result.error).toBe('');
      expect(result.suggestion).toContain(
        'Parent outputs extra properties [email]',
      );
    });

    it('should handle parent with no output properties', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {},
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            name: { type: 'string' },
          },
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(false);
      expect(result.error).toContain(
        'Child node child-1 expects input properties but parent node parent-1 has no output properties',
      );
      expect(result.suggestion).toContain(
        'Ensure parent node parent-1 produces output properties: name',
      );
    });

    it('should handle missing schemas gracefully', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: undefined,
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: undefined,
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(true);
      expect(result.suggestion).toBe('Schema compatibility is perfect');
    });

    it('should handle child with no input requirements', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            name: { type: 'string' },
          },
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {},
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(true);
      expect(result.suggestion).toContain(
        'Parent outputs extra properties [name]',
      );
    });

    it('should validate nested object schemas', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' },
              },
            },
          },
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' },
              },
            },
          },
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(true);
      expect(result.suggestion).toBe('Schema compatibility is perfect');
    });

    it('should detect missing nested object properties', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' },
                email: { type: 'string' },
              },
            },
          },
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(false);
      expect(result.error).toContain(
        "Nested object 'child-1.user' expects properties [age, email] but parent 'parent-1.user' provides [name]",
      );
      expect(result.suggestion).toContain(
        "Add missing properties to 'parent-1.user': age, email",
      );
    });

    it('should detect nested object type mismatches', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'string' },
              },
            },
          },
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' },
              },
            },
          },
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(false);
      expect(result.error).toContain(
        "Property 'child-1.user.age' expects type 'number' but parent outputs type 'string'",
      );
      expect(result.suggestion).toContain(
        "Ensure type compatibility for property 'child-1.user.age'",
      );
    });

    it('should validate array schemas', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(true);
      expect(result.suggestion).toBe('Schema compatibility is perfect');
    });

    it('should detect array item type mismatches', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            numbers: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            numbers: {
              type: 'array',
              items: { type: 'number' },
            },
          },
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(false);
      expect(result.error).toContain(
        "Property 'child-1.numbers[items]' expects type 'number' but parent outputs type 'string'",
      );
      expect(result.suggestion).toContain(
        "Ensure type compatibility for property 'child-1.numbers[items]'",
      );
    });

    it('should validate array of objects', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  age: { type: 'number' },
                },
              },
            },
          },
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  age: { type: 'number' },
                },
              },
            },
          },
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(true);
      expect(result.suggestion).toBe('Schema compatibility is perfect');
    });

    it('should detect missing properties in array of objects', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  age: { type: 'number' },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(false);
      expect(result.error).toContain(
        "Array items in 'child-1.users' expect properties [age, email] but parent 'parent-1.users' item provides [name]",
      );
      expect(result.suggestion).toContain(
        "Add missing item properties to 'parent-1.users': age, email",
      );
    });

    it('should handle deeply nested object structures', () => {
      const parent: ToolNode = {
        identifier: 'parent-1',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: {
          properties: {
            company: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                address: {
                  type: 'object',
                  properties: {
                    street: { type: 'string' },
                    city: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      };

      const child: ToolNode = {
        identifier: 'child-1',
        type: 'tool',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: {
          properties: {
            company: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                address: {
                  type: 'object',
                  properties: {
                    street: { type: 'string' },
                    city: { type: 'string' },
                    zipCode: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        outputSchema: {},
      };

      const result = workflow.checkInputAndOutputFit(parent, child);

      expect(result.isInputFit).toBe(false);
      expect(result.error).toContain(
        "Nested object 'child-1.company.address' expects properties [zipCode] but parent 'parent-1.company.address' provides [street, city]",
      );
      expect(result.suggestion).toContain(
        "Add missing properties to 'parent-1.company.address': zipCode",
      );
    });
  });
});
