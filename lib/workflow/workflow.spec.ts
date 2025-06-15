import type { ConditionNode, CronjobTriggerNode, ToolNode } from './types';
import { Workflow } from './workflow';
import { McpRouter } from '../router/mcpRouter';
import { WorkflowToolMissingError } from './errors';
import nock from 'nock';
import { v4 } from 'uuid';

// Mock mcpRouter for testing
class MockMcpRouter extends McpRouter {
  constructor() {
    super('http://localhost:3000', 'test-api-key');
  }

  async checkToolsExist(_tools: string[]): Promise<{ missingTools: string[] }> {
    return { missingTools: [] };
  }
}

const mockMcpRouter = new MockMcpRouter();

describe('Workflow', () => {
  let workflow: Workflow;
  const mockTrigger: CronjobTriggerNode = {
    identifier: '550e8400-e29b-41d4-a716-446655440000',
    type: 'cronjob-trigger',
    cron: '0 2 * * *',
    child: null,
  };

  beforeEach(() => {
    workflow = new Workflow('Test Workflow', mockTrigger, mockMcpRouter);
    // Reset mock before each test
    jest.clearAllMocks();
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
      };

      const childNode: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440003',
        type: 'tool',
        toolIdentifier: 'child-tool',
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
      };

      const newChildNode: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440007',
        type: 'tool',
        toolIdentifier: 'new-tool',
        child: null,
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
        toolIdentifier: 'original-tool',
        child: null,
      };

      const modifiedChild: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440009',
        type: 'tool',
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
        child: null,
      };

      expect(() => {
        workflow.modifyChild('550e8400-e29b-41d4-a716-446655440000', childNode);
      }).toThrow('Cannot modify root trigger node');
    });
  });

  describe('modifyTrigger', () => {
    it('should preserve child when modifying trigger', () => {
      // Add a child to the trigger
      const childNode: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440900',
        type: 'tool',
        toolIdentifier: 'test-child-tool',
        description: 'Test Child Tool',
        child: null,
      };

      workflow.addChild(undefined, childNode);

      // Verify child is added
      expect(workflow.getWorkflow().trigger.child).toEqual(childNode);

      // Create new trigger with different cron schedule
      const newTrigger: CronjobTriggerNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440901',
        type: 'cronjob-trigger',
        cron: '0 3 * * *', // Different cron from original
      };

      // Modify the trigger
      workflow.modifyTrigger(newTrigger);

      // Verify the trigger has been updated but child is preserved
      const updatedWorkflow = workflow.getWorkflow();
      expect(updatedWorkflow.trigger.identifier).toBe(newTrigger.identifier);
      expect(updatedWorkflow.trigger.cron).toBe('0 3 * * *');
      expect(updatedWorkflow.trigger.child).toEqual(childNode);
    });

    it('should work correctly when trigger has no child', () => {
      // Create a fresh workflow for this test to ensure no child exists
      const freshTrigger: CronjobTriggerNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440903',
        type: 'cronjob-trigger',
        cron: '0 1 * * *',
        child: null,
      };
      const freshWorkflow = new Workflow(
        'Fresh Test Workflow',
        freshTrigger,
        mockMcpRouter,
      );

      // Create new trigger with different cron schedule
      const newTrigger: CronjobTriggerNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440902',
        type: 'cronjob-trigger',
        cron: '0 4 * * *',
      };

      // Verify original trigger has no child
      expect(freshWorkflow.getWorkflow().trigger.child).toBeNull();

      // Modify the trigger
      freshWorkflow.modifyTrigger(newTrigger);

      // Verify the trigger has been updated and child remains null
      const updatedWorkflow = freshWorkflow.getWorkflow();
      expect(updatedWorkflow.trigger.identifier).toBe(newTrigger.identifier);
      expect(updatedWorkflow.trigger.cron).toBe('0 4 * * *');
      expect(updatedWorkflow.trigger.child).toBeNull();
    });
  });

  describe('compile', () => {
    it('should validate and return workflow when valid', async () => {
      // Test with a fresh workflow that has no children added
      const freshTrigger: CronjobTriggerNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440100',
        type: 'cronjob-trigger',
        cron: '0 2 * * *',
        child: null,
      };
      const freshWorkflow = new Workflow(
        'Test Workflow',
        freshTrigger,
        mockMcpRouter,
      );
      const result = await freshWorkflow.compile();
      expect(result).toEqual({
        title: 'Test Workflow',
        trigger: freshTrigger,
      });
    });

    it('should throw error when workflow is invalid', async () => {
      // Create workflow with invalid trigger (empty title)
      const freshTrigger: CronjobTriggerNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440101',
        type: 'cronjob-trigger',
        cron: '0 2 * * *',
        child: null,
      };
      const invalidWorkflow = new Workflow('', freshTrigger, mockMcpRouter);

      await expect(invalidWorkflow.compile()).rejects.toThrow(
        'Workflow validation failed:',
      );
    });

    it('should pass compilation with compatible tool nodes', async () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440200',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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

      await expect(workflow.compile()).resolves.toBeDefined();
    });

    it('should fail compilation with incompatible tool nodes (property mismatch)', async () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440202',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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

      await expect(workflow.compile()).rejects.toThrow(
        /Input and output mismatch:/,
      );
    });

    it('should fail compilation with incompatible tool nodes (type mismatch)', async () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440204',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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

      await expect(workflow.compile()).rejects.toThrow(
        /Property '550e8400-e29b-41d4-a716-446655440205\.age' expects type 'string' but parent outputs type 'number'/,
      );
    });

    it('should fail compilation with multiple compatibility issues', async () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440206',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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

      await expect(workflow.compile()).rejects.toThrow(
        /Input and output mismatch:/,
      );
    });

    it('should pass compilation when parent outputs extra properties', async () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440208',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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

      await expect(workflow.compile()).resolves.toBeDefined();
    });

    it('should fail compilation when parent has no output but child expects input', async () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440210',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        description: 'Test Workflow',
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
        description: 'Test Workflow',
        inputSchema: {
          properties: {
            name: { type: 'string' },
          },
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440210', child);

      await expect(workflow.compile()).rejects.toThrow(
        /Child node 550e8400-e29b-41d4-a716-446655440211 expects input properties but parent node 550e8400-e29b-41d4-a716-446655440210 has no output properties/,
      );
    });

    it('should pass compilation with nodes that have no schemas', async () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440212',
        type: 'tool',
        description: 'Test Workflow',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: undefined,
        outputSchema: undefined,
      };

      const child: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440213',
        type: 'tool',
        description: 'Test Workflow',
        toolIdentifier: 'child-tool',
        child: null,
        inputSchema: undefined,
        outputSchema: undefined,
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440212', child);

      await expect(workflow.compile()).resolves.toBeDefined();
    });

    it('should pass compilation when child has no input requirements', async () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440214',
        type: 'tool',
        description: 'Test Workflow',
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
        description: 'Test Workflow',
        inputSchema: {
          properties: {},
        },
        outputSchema: {},
      };

      workflow.addChild(undefined, parent);
      workflow.addChild('550e8400-e29b-41d4-a716-446655440214', child);

      await expect(workflow.compile()).resolves.toBeDefined();
    });

    it('should pass compilation with complex nested object compatibility', async () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440216',
        type: 'tool',
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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

      await expect(workflow.compile()).resolves.toBeDefined();
    });

    it('should fail compilation with nested object incompatibility', async () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440218',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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

      await expect(workflow.compile()).rejects.toThrow(
        /Nested object '550e8400-e29b-41d4-a716-446655440219\.user' expects properties \[age, email\]/,
      );
    });

    it('should pass compilation with array schemas', async () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440220',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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

      await expect(workflow.compile()).resolves.toBeDefined();
    });

    it('should fail compilation with array item type mismatch', async () => {
      const parent: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440222',
        type: 'tool',
        toolIdentifier: 'parent-tool',
        child: null,
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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

      await expect(workflow.compile()).rejects.toThrow(
        /Property '550e8400-e29b-41d4-a716-446655440223\.numbers\[items\]' expects type 'number' but parent outputs type 'string'/,
      );
    });

    it('should handle workflow with chained tool nodes', async () => {
      const first: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440224',
        type: 'tool',
        toolIdentifier: 'first-tool',
        child: null,
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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

      await expect(workflow.compile()).resolves.toBeDefined();
    });

    it('should detect incompatibility in a chain of tool nodes', async () => {
      const first: ToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440227',
        type: 'tool',
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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

      await expect(workflow.compile()).rejects.toThrow(
        /Property '550e8400-e29b-41d4-a716-446655440229\.result' expects type 'string' but parent outputs type 'number'/,
      );
    });

    describe('Tool existence checking', () => {
      const baseUrl = 'http://localhost:3000';
      let realMcpRouter: McpRouter;
      let workflowWithRealRouter: Workflow;

      beforeEach(() => {
        // Clear all nock interceptors before each test
        nock.cleanAll();

        // Create workflow with real McpRouter for testing HTTP calls
        realMcpRouter = new McpRouter(
          'http://localhost:3000/sse',
          'test-api-key',
        );
        const freshTrigger: CronjobTriggerNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440300',
          type: 'cronjob-trigger',
          cron: '0 2 * * *',
          child: null,
        };
        workflowWithRealRouter = new Workflow(
          'Test Workflow with Real Router',
          freshTrigger,
          realMcpRouter,
        );
      });

      afterEach(() => {
        // Clean up any remaining interceptors
        nock.cleanAll();
      });

      it('should pass compilation when all tools exist', async () => {
        const toolNode: ToolNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440301',
          type: 'tool',
          description: 'Test Workflow',
          toolIdentifier: 'existing-tool',
          child: null,
        };

        workflowWithRealRouter.addChild(undefined, toolNode);

        nock(baseUrl)
          .get('/tools/check')
          .query(true)
          .matchHeader('x-api-key', 'test-api-key')
          .reply(200, { exists: true });

        await expect(workflowWithRealRouter.compile()).resolves.toBeDefined();
      });

      it('should throw WorkflowToolMissingError when tools do not exist', async () => {
        const toolNode: ToolNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440302',
          type: 'tool',
          toolIdentifier: 'missing-tool',
          description: 'Test Workflow',
          child: null,
        };

        workflowWithRealRouter.addChild(undefined, toolNode);

        nock(baseUrl)
          .get('/tools/check')
          .query({ ids: 'missing-tool' })
          .matchHeader('Authorization', 'Bearer test-api-key')
          .reply(200, { exists: false });

        await expect(workflowWithRealRouter.compile()).rejects.toThrow(
          WorkflowToolMissingError,
        );

        try {
          await workflowWithRealRouter.compile();
        } catch (error) {
          expect(error).toBeInstanceOf(WorkflowToolMissingError);
          expect((error as WorkflowToolMissingError).getMissingTools()).toEqual(
            ['missing-tool'],
          );
        }
      });

      it('should throw WorkflowToolMissingError with multiple missing tools', async () => {
        const firstTool: ToolNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440303',
          type: 'tool',
          toolIdentifier: 'missing-tool-1',
          description: 'Test Workflow',
          child: null,
        };

        const secondTool: ToolNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440304',
          type: 'tool',
          toolIdentifier: 'missing-tool-2',
          description: 'Test Workflow',
          child: null,
        };

        workflowWithRealRouter.addChild(undefined, firstTool);
        workflowWithRealRouter.addChild(
          '550e8400-e29b-41d4-a716-446655440303',
          secondTool,
        );

        nock(baseUrl)
          .get('/tools/check')
          .query({ ids: ['missing-tool-1', 'missing-tool-2'] })
          .matchHeader('Authorization', 'Bearer test-api-key')
          .reply(200, { exists: false });

        await expect(workflowWithRealRouter.compile()).rejects.toThrow(
          WorkflowToolMissingError,
        );

        try {
          await workflowWithRealRouter.compile();
        } catch (error) {
          expect(error).toBeInstanceOf(WorkflowToolMissingError);
          expect((error as WorkflowToolMissingError).getMissingTools()).toEqual(
            ['missing-tool-1', 'missing-tool-2'],
          );
        }
      });

      it('should handle mixed existing and missing tools in complex workflow', async () => {
        const firstTool: ToolNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440311',
          type: 'tool',
          toolIdentifier: 'existing-tool-1',
          description: 'Test Workflow',
          child: null,
        };

        const secondTool: ToolNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440312',
          type: 'tool',
          toolIdentifier: 'missing-tool-1',
          description: 'Test Workflow',
          child: null,
        };

        const thirdTool: ToolNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440313',
          type: 'tool',
          toolIdentifier: 'existing-tool-2',
          description: 'Test Workflow',
          child: null,
        };

        const fourthTool: ToolNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440314',
          type: 'tool',
          toolIdentifier: 'missing-tool-2',
          description: 'Test Workflow',
          child: null,
        };

        workflowWithRealRouter.addChild(undefined, firstTool);
        workflowWithRealRouter.addChild(
          '550e8400-e29b-41d4-a716-446655440311',
          secondTool,
        );
        workflowWithRealRouter.addChild(
          '550e8400-e29b-41d4-a716-446655440312',
          thirdTool,
        );
        workflowWithRealRouter.addChild(
          '550e8400-e29b-41d4-a716-446655440313',
          fourthTool,
        );

        nock(baseUrl)
          .get('/tools/check')
          .query(true) // Match any query parameters
          .matchHeader('Authorization', 'Bearer test-api-key')
          .reply(400, {
            error: 'Some tools not found',
            missingIds: ['missing-tool-1', 'missing-tool-2'],
          });

        await expect(workflowWithRealRouter.compile()).rejects.toThrow(
          WorkflowToolMissingError,
        );
      });

      it('should handle partial missing tools from 400 error response', async () => {
        const firstTool: ToolNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440305',
          type: 'tool',
          toolIdentifier: 'existing-tool',
          description: 'Test Workflow',
          child: null,
        };

        const secondTool: ToolNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440306',
          type: 'tool',
          toolIdentifier: 'missing-tool',
          child: null,
          description: 'Test Workflow',
        };

        workflowWithRealRouter.addChild(undefined, firstTool);
        workflowWithRealRouter.addChild(
          '550e8400-e29b-41d4-a716-446655440305',
          secondTool,
        );

        nock(baseUrl)
          .get('/tools/check')
          .query(true) // Match any query parameters
          .matchHeader('Authorization', 'Bearer test-api-key')
          .reply(400, {
            error: 'Some tools not found',
            missingIds: ['missing-tool'],
          });

        await expect(workflowWithRealRouter.compile()).rejects.toThrow(
          WorkflowToolMissingError,
        );
      });

      it('should treat all tools as missing when 400 error has no missingIds', async () => {
        const toolNode: ToolNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440307',
          type: 'tool',
          toolIdentifier: 'problematic-tool',
          description: 'Test Workflow',
          child: null,
        };

        workflowWithRealRouter.addChild(undefined, toolNode);

        nock(baseUrl)
          .get('/tools/check')
          .query(true)
          .matchHeader('Authorization', 'Bearer test-api-key')
          .reply(400, {
            error: 'Invalid input',
          });

        await expect(workflowWithRealRouter.compile()).rejects.toThrow(
          WorkflowToolMissingError,
        );

        try {
          await workflowWithRealRouter.compile();
        } catch (error) {
          expect(error).toBeInstanceOf(WorkflowToolMissingError);
          expect((error as WorkflowToolMissingError).getMissingTools()).toEqual(
            ['problematic-tool'],
          );
        }
      });

      it('should treat all tools as missing when server error occurs', async () => {
        const toolNode: ToolNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440308',
          type: 'tool',
          toolIdentifier: 'server-error-tool',
          child: null,
          description: 'Test Workflow',
        };

        workflowWithRealRouter.addChild(undefined, toolNode);

        nock(baseUrl)
          .get('/tools/check')
          .query(true)
          .matchHeader('Authorization', 'Bearer test-api-key')
          .reply(500, {
            error: 'Internal server error',
          });

        await expect(workflowWithRealRouter.compile()).rejects.toThrow(
          WorkflowToolMissingError,
        );

        try {
          await workflowWithRealRouter.compile();
        } catch (error) {
          expect(error).toBeInstanceOf(WorkflowToolMissingError);
          expect((error as WorkflowToolMissingError).getMissingTools()).toEqual(
            ['server-error-tool'],
          );
        }
      });

      it('should treat all tools as missing when network error occurs', async () => {
        const toolNode: ToolNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440309',
          type: 'tool',
          toolIdentifier: 'network-error-tool',
          child: null,
          description: 'Test Workflow',
        };

        workflowWithRealRouter.addChild(undefined, toolNode);

        nock(baseUrl)
          .get('/tools/check')
          .query(true)
          .matchHeader('Authorization', 'Bearer test-api-key')
          .replyWithError('Network connection failed');

        await expect(workflowWithRealRouter.compile()).rejects.toThrow(
          WorkflowToolMissingError,
        );

        try {
          await workflowWithRealRouter.compile();
        } catch (error) {
          expect(error).toBeInstanceOf(WorkflowToolMissingError);
          expect((error as WorkflowToolMissingError).getMissingTools()).toEqual(
            ['network-error-tool'],
          );
        }
      });

      it('should handle malformed JSON response', async () => {
        const toolNode: ToolNode = {
          identifier: '550e8400-e29b-41d4-a716-446655440310',
          type: 'tool',
          toolIdentifier: 'malformed-response-tool',
          child: null,
          description: 'Test Workflow',
        };

        workflowWithRealRouter.addChild(undefined, toolNode);

        nock(baseUrl)
          .get('/tools/check')
          .query(true)
          .matchHeader('Authorization', 'Bearer test-api-key')
          .reply(200, 'invalid json response');

        await expect(workflowWithRealRouter.compile()).rejects.toThrow(
          WorkflowToolMissingError,
        );

        try {
          await workflowWithRealRouter.compile();
        } catch (error) {
          expect(error).toBeInstanceOf(WorkflowToolMissingError);
          expect((error as WorkflowToolMissingError).getMissingTools()).toEqual(
            ['malformed-response-tool'],
          );
        }
      });

      it('should pass compilation with workflow containing no tool nodes', async () => {
        // Workflow with only trigger, no tool nodes
        nock(baseUrl)
          .get('/tools/check')
          .matchHeader('Authorization', 'Bearer test-api-key')
          .reply(200, { exists: true });

        await expect(workflowWithRealRouter.compile()).resolves.toBeDefined();
      });
    });
  });

  describe('readFrom', () => {
    beforeEach(() => {
      process.env.MCP_ROUTER_SERVER_URL = 'http://localhost:3000';
      process.env.MCP_ROUTER_SERVER_API_KEY = 'test-api-key';
    });

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

      const workflow = Workflow.readFrom(workflowData);
      expect(workflow.getWorkflow()).toEqual(workflowData);
    });

    it('should throw error when JSON object is invalid', () => {
      const invalidWorkflowData = {
        title: '',
        trigger: null,
      };

      expect(() => {
        Workflow.readFrom(invalidWorkflowData as any);
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
        toolIdentifier: 'parent-tool',
        child: null,
        inputSchema: {},
        outputSchema: undefined,
      };

      const child: ToolNode = {
        identifier: 'child-1',
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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
        description: 'Test Workflow',
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

  describe('addAfter', () => {
    it('should add a child node after the node with the identifier', () => {
      const id1 = v4();
      const id2 = v4();

      const workflow = new Workflow(
        'Test Workflow',
        {
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          identifier: id1,
        },
        mockMcpRouter,
      );

      const child: ToolNode = {
        identifier: id2,
        type: 'tool',
        toolIdentifier: 'child-tool',
        description: 'Test Workflow',
        child: null,
        inputSchema: {},
        outputSchema: {},
      };

      workflow.addAfter(undefined, child);

      expect(workflow.getWorkflow().trigger.child).toEqual(child);
    });

    it('should add a child node between the node with the identifier and its child', () => {
      const id1 = v4();
      const id2 = v4();
      const id3 = v4();
      const id4 = v4();

      const workflow = new Workflow(
        'Test Workflow',
        {
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          identifier: id1,
        },
        mockMcpRouter,
      );

      const child: ToolNode = {
        identifier: id2,
        type: 'tool',
        toolIdentifier: 'child-tool',
        description: 'Test Workflow',
        child: null,
        inputSchema: {},
        outputSchema: {},
      };

      const child2: ToolNode = {
        identifier: id3,
        type: 'tool',
        toolIdentifier: 'child-tool-2',
        description: 'Test Workflow',
        child: null,
      };

      const child3: ToolNode = {
        identifier: id4,
        type: 'tool',
        toolIdentifier: 'child-tool-3',
        description: 'Test Workflow',
        child: null,
      };

      workflow.addChild(undefined, child);
      workflow.addChild(id2, child2);

      workflow.addAfter(id2, child3);

      expect(workflow.getWorkflow().trigger.child.child.toolIdentifier).toEqual(
        'child-tool-3',
      );

      expect(
        workflow.getWorkflow().trigger.child.child.child.toolIdentifier,
      ).toEqual('child-tool-2');
    });
  });

  describe('swapNodes', () => {
    beforeEach(() => {
      // Create a fresh workflow for each test
      const freshTrigger: CronjobTriggerNode = {
        identifier: 'trigger-id',
        type: 'cronjob-trigger',
        cron: '0 2 * * *',
        child: null,
      };
      workflow = new Workflow('Test Workflow', freshTrigger, mockMcpRouter);
    });

    it('should swap two tool nodes successfully', () => {
      const node1: ToolNode = {
        identifier: 'node1',
        type: 'tool',
        toolIdentifier: 'tool1',
        description: 'Tool 1',
        child: null,
      };

      const node2: ToolNode = {
        identifier: 'node2',
        type: 'tool',
        toolIdentifier: 'tool2',
        description: 'Tool 2',
        child: null,
      };

      const node3: ToolNode = {
        identifier: 'node3',
        type: 'tool',
        toolIdentifier: 'tool3',
        description: 'Tool 3',
        child: null,
      };

      // Build workflow: trigger -> node1 -> node2 -> node3
      workflow.addChild(undefined, node1);
      workflow.addChild('node1', node2);
      workflow.addChild('node2', node3);

      // Swap node1 and node2
      workflow.swapNodes('node1', 'node2');

      // Verify the structure is now: trigger -> node2 -> node1 -> node3
      const workflowData = workflow.getWorkflow();
      expect(workflowData.trigger.child?.identifier).toBe('node2');
      expect((workflowData.trigger.child as any)?.child?.identifier).toBe(
        'node1',
      );
      expect(
        (workflowData.trigger.child as any)?.child?.child?.identifier,
      ).toBe('node3');
    });

    it('should preserve child relationships when swapping nodes with children', () => {
      const node1: ToolNode = {
        identifier: 'node1',
        type: 'tool',
        toolIdentifier: 'tool1',
        description: 'Tool 1',
        child: null,
      };

      const node2: ToolNode = {
        identifier: 'node2',
        type: 'tool',
        toolIdentifier: 'tool2',
        description: 'Tool 2',
        child: null,
      };

      const child1: ToolNode = {
        identifier: 'child1',
        type: 'tool',
        toolIdentifier: 'child-tool1',
        description: 'Child Tool 1',
        child: null,
      };

      const child2: ToolNode = {
        identifier: 'child2',
        type: 'tool',
        toolIdentifier: 'child-tool2',
        description: 'Child Tool 2',
        child: null,
      };

      // Build workflow: trigger -> node1 -> child1 -> node2 -> child2
      workflow.addChild(undefined, node1);
      workflow.addChild('node1', child1);
      workflow.addChild('child1', node2);
      workflow.addChild('node2', child2);

      // Now swap node1 and node2
      // New structure should be: trigger -> node2 -> child1 -> node1 -> child2
      workflow.swapNodes('node1', 'node2');

      // Verify that node2 is now first and node1 is later, with their children preserved
      const workflowData = workflow.getWorkflow();
      expect(workflowData.trigger.child?.identifier).toBe('node2');
      expect((workflowData.trigger.child as any)?.child?.identifier).toBe(
        'child1',
      );
      expect(
        (workflowData.trigger.child as any)?.child?.child?.identifier,
      ).toBe('node1');
      expect(
        (workflowData.trigger.child as any)?.child?.child?.child?.identifier,
      ).toBe('child2');
    });

    it('should throw error when trying to swap non-existent node', () => {
      const node1: ToolNode = {
        identifier: 'node1',
        type: 'tool',
        toolIdentifier: 'tool1',
        description: 'Tool 1',
        child: null,
      };

      workflow.addChild(undefined, node1);

      expect(() => {
        workflow.swapNodes('node1', 'non-existent');
      }).toThrow('Node with identifier node1 or non-existent not found');

      expect(() => {
        workflow.swapNodes('non-existent', 'node1');
      }).toThrow('Node with identifier non-existent or node1 not found');
    });

    it('should throw error when trying to swap trigger node', () => {
      const node1: ToolNode = {
        identifier: 'node1',
        type: 'tool',
        toolIdentifier: 'tool1',
        description: 'Tool 1',
        child: null,
      };

      workflow.addChild(undefined, node1);

      expect(() => {
        workflow.swapNodes('trigger-id', 'node1');
      }).toThrow('Cannot swap trigger node');

      expect(() => {
        workflow.swapNodes('node1', 'trigger-id');
      }).toThrow('Cannot swap trigger node');
    });

    it('should throw error when trying to swap a node with itself', () => {
      const node1: ToolNode = {
        identifier: 'node1',
        type: 'tool',
        toolIdentifier: 'tool1',
        description: 'Tool 1',
        child: null,
      };

      workflow.addChild(undefined, node1);

      expect(() => {
        workflow.swapNodes('node1', 'node1');
      }).toThrow('Cannot swap a node with itself');
    });

    it('should swap nodes in a complex workflow with multiple levels', () => {
      const node1: ToolNode = {
        identifier: 'node1',
        type: 'tool',
        toolIdentifier: 'tool1',
        description: 'Tool 1',
        child: null,
      };

      const node2: ToolNode = {
        identifier: 'node2',
        type: 'tool',
        toolIdentifier: 'tool2',
        description: 'Tool 2',
        child: null,
      };

      const node3: ToolNode = {
        identifier: 'node3',
        type: 'tool',
        toolIdentifier: 'tool3',
        description: 'Tool 3',
        child: null,
      };

      const node4: ToolNode = {
        identifier: 'node4',
        type: 'tool',
        toolIdentifier: 'tool4',
        description: 'Tool 4',
        child: null,
      };

      // Build workflow: trigger -> node1 -> node2 -> node3 -> node4
      workflow.addChild(undefined, node1);
      workflow.addChild('node1', node2);
      workflow.addChild('node2', node3);
      workflow.addChild('node3', node4);

      // Swap node2 and node3 (middle nodes)
      workflow.swapNodes('node2', 'node3');

      // Verify the structure is now: trigger -> node1 -> node3 -> node2 -> node4
      const workflowData = workflow.getWorkflow();
      expect(workflowData.trigger.child?.identifier).toBe('node1');
      expect((workflowData.trigger.child as any)?.child?.identifier).toBe(
        'node3',
      );
      expect(
        (workflowData.trigger.child as any)?.child?.child?.identifier,
      ).toBe('node2');
      expect(
        (workflowData.trigger.child as any)?.child?.child?.child?.identifier,
      ).toBe('node4');
    });

    it('should work with condition nodes that have children arrays', () => {
      const conditionNode: ConditionNode = {
        identifier: 'condition1',
        type: 'condition',
        code: 'return "node1";',
        runtime: 'js',
        children: [],
      };

      const node1: ToolNode = {
        identifier: 'node1',
        type: 'tool',
        toolIdentifier: 'tool1',
        description: 'Tool 1',
        child: null,
      };

      const node2: ToolNode = {
        identifier: 'node2',
        type: 'tool',
        toolIdentifier: 'tool2',
        description: 'Tool 2',
        child: null,
      };

      // Build workflow: trigger -> conditionNode with children [node1, node2]
      workflow.addChild(undefined, conditionNode);
      workflow.addChild('condition1', node1);
      workflow.addChild('condition1', node2);

      // Swap the two child nodes
      workflow.swapNodes('node1', 'node2');

      // Verify that the nodes are swapped in the children array
      const workflowData = workflow.getWorkflow();
      const condition = workflowData.trigger.child as ConditionNode;
      expect(condition.children[0].identifier).toBe('node2');
      expect(condition.children[1].identifier).toBe('node1');
    });

    it('should swap nodes between different parent types (single child and children array)', () => {
      const conditionNode: ConditionNode = {
        identifier: 'condition1',
        type: 'condition',
        code: 'return "node1";',
        runtime: 'js',
        children: [],
      };

      const regularNode: ToolNode = {
        identifier: 'regular1',
        type: 'tool',
        toolIdentifier: 'regular-tool',
        description: 'Regular Tool',
        child: null,
      };

      const childNode1: ToolNode = {
        identifier: 'child1',
        type: 'tool',
        toolIdentifier: 'child-tool1',
        description: 'Child Tool 1',
        child: null,
      };

      const childNode2: ToolNode = {
        identifier: 'child2',
        type: 'tool',
        toolIdentifier: 'child-tool2',
        description: 'Child Tool 2',
        child: null,
      };

      // Build workflow: trigger -> conditionNode -> [child1] -> regularNode -> child2
      workflow.addChild(undefined, conditionNode);
      workflow.addChild('condition1', childNode1);
      workflow.addChild('condition1', regularNode);
      workflow.addChild('regular1', childNode2);

      // Swap child1 (from children array) with child2 (from single child)
      workflow.swapNodes('child1', 'child2');

      // Verify the swap occurred correctly
      const workflowData = workflow.getWorkflow();
      const condition = workflowData.trigger.child as ConditionNode;

      expect(condition.children[0].identifier).toBe('child2');
      expect(condition.children[1].identifier).toBe('regular1');
      expect((condition.children[1] as ToolNode).child?.identifier).toBe(
        'child1',
      );
    });

    it('should preserve deep child structures when swapping', () => {
      const node1: ToolNode = {
        identifier: 'node1',
        type: 'tool',
        toolIdentifier: 'tool1',
        description: 'Tool 1',
        child: null,
      };

      const node2: ToolNode = {
        identifier: 'node2',
        type: 'tool',
        toolIdentifier: 'tool2',
        description: 'Tool 2',
        child: null,
      };

      const deepChild1: ToolNode = {
        identifier: 'deep1',
        type: 'tool',
        toolIdentifier: 'deep-tool1',
        description: 'Deep Tool 1',
        child: null,
      };

      const deepChild2: ToolNode = {
        identifier: 'deep2',
        type: 'tool',
        toolIdentifier: 'deep-tool2',
        description: 'Deep Tool 2',
        child: null,
      };

      const deepestChild: ToolNode = {
        identifier: 'deepest',
        type: 'tool',
        toolIdentifier: 'deepest-tool',
        description: 'Deepest Tool',
        child: null,
      };

      // Build complex structure:
      // trigger -> node1 -> deep1 -> deepest -> node2 -> deep2
      workflow.addChild(undefined, node1);
      workflow.addChild('node1', deepChild1);
      workflow.addChild('deep1', deepestChild);
      workflow.addChild('deepest', node2);
      workflow.addChild('node2', deepChild2);

      // Swap node1 and node2, which should preserve their entire subtrees
      // New structure should be:
      // trigger -> node2 -> deep1 -> deepest -> node1 -> deep2
      workflow.swapNodes('node1', 'node2');

      // Verify the structure is now:
      // trigger -> node2 -> deep2 -> node1 -> deep1 -> deepest
      const workflowData = workflow.getWorkflow();
      expect(workflowData.trigger.child?.identifier).toBe('node2');
      expect((workflowData.trigger.child as any)?.child?.identifier).toBe(
        'deep1',
      );
      expect(
        (workflowData.trigger.child as any)?.child?.child?.identifier,
      ).toBe('deepest');
      expect(
        (workflowData.trigger.child as any)?.child?.child?.child?.identifier,
      ).toBe('node1');
      expect(
        (workflowData.trigger.child as any)?.child?.child?.child?.child
          ?.identifier,
      ).toBe('deep2');
    });
  });
});
