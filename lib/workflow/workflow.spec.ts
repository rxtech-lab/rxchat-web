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
});
