import type { ConditionNode, ConverterNode, ToolNode, Workflow } from './types';
import {
  type JSCodeExecutionEngine,
  type ToolExecutionEngine,
  WorkflowEngine,
} from './workflow-engine';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let jsCodeExecutionEngine: JSCodeExecutionEngine;
  let toolExecutionEngine: ToolExecutionEngine;

  beforeEach(() => {
    jsCodeExecutionEngine = {
      execute: jest.fn(),
    };
    toolExecutionEngine = {
      execute: jest.fn(),
    };
    engine = new WorkflowEngine(jsCodeExecutionEngine, toolExecutionEngine);
  });

  describe('Basic Workflow Execution', () => {
    it('should throw error if workflow with just a trigger', async () => {
      const workflow: Workflow = {
        title: 'Simple Trigger Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: null,
        },
      };

      // Should not throw any errors
      await expect(engine.execute(workflow)).rejects.toThrow();
    });

    it('Should be able to execute a workflow with condition node', async () => {
      const node1: ToolNode = {
        identifier: 'node1',
        type: 'tool',
        toolIdentifier: 'tool1',
        description: 'Test tool 1',
      };

      const node2: ToolNode = {
        identifier: 'node2',
        type: 'tool',
        toolIdentifier: 'tool2',
        description: 'Test tool 2',
      };

      const conditionNode: ConditionNode = {
        identifier: 'condition',
        type: 'condition',
        code: 'return "node1";',
        children: [node1, node2],
        runtime: 'js',
      };

      const workflow: Workflow = {
        title: 'Condition Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: conditionNode,
        },
      };

      // mock the jsCodeExecutionEngine to return "node1"
      jsCodeExecutionEngine.execute = jest.fn().mockReturnValue('node1');

      // mock the toolExecutionEngine to return "tool1"
      toolExecutionEngine.execute = jest.fn().mockReturnValue('tool1');

      await expect(engine.execute(workflow)).resolves.not.toThrow();
      // toolExecutionEngine should be called 1 time
      expect(toolExecutionEngine.execute).toHaveBeenCalledTimes(1);
      // jsCodeExecutionEngine should be called 1 time
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledTimes(1);

      // expect input to be "tool1"
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledWith(
        null,
        'return "node1";',
        { nodeId: 'condition' },
      );
    });

    it('Should be able to execute a workflow with condition node in the middle', async () => {
      const node2: ToolNode = {
        identifier: 'node2',
        type: 'tool',
        toolIdentifier: 'tool2',
        description: 'Test tool 2',
      };

      const conditionNode: ConditionNode = {
        identifier: 'condition',
        type: 'condition',
        code: 'return "node1";',
        children: [node2],
        runtime: 'js',
      };

      const node1: ToolNode = {
        identifier: 'node1',
        type: 'tool',
        toolIdentifier: 'tool1',
        child: conditionNode,
        description: 'Test tool 1',
      };

      const workflow: Workflow = {
        title: 'Condition Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: node1,
        },
      };

      // mock the jsCodeExecutionEngine to return "node1"
      jsCodeExecutionEngine.execute = jest.fn().mockReturnValue('node1');

      // mock the toolExecutionEngine to return "tool1"
      toolExecutionEngine.execute = jest.fn().mockReturnValue('tool1');

      await expect(engine.execute(workflow)).resolves.not.toThrow();
      // toolExecutionEngine should be called 1 time
      expect(toolExecutionEngine.execute).toHaveBeenCalledTimes(1);
      // jsCodeExecutionEngine should be called 1 time
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledTimes(1);

      // expect input to be "tool1"
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledWith(
        {
          input: 'tool1',
          nodeId: 'node1',
        },
        'return "node1";',
        { nodeId: 'condition' },
      );
    });

    it('Should be able to execute a workflow with converter node', async () => {
      const converterNode: ConverterNode = {
        identifier: 'converter',
        type: 'converter',
        code: 'return "tool1";',
        runtime: 'js',
      };

      const node1: ToolNode = {
        identifier: 'node1',
        type: 'tool',
        toolIdentifier: 'tool1',
        description: 'Test tool 1',
      };

      const node2: ToolNode = {
        identifier: 'node2',
        type: 'tool',
        toolIdentifier: 'tool2',
        description: 'Test tool 2',
      };

      node1.child = converterNode;
      converterNode.child = node2;

      const workflow: Workflow = {
        title: 'Condition Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: node1,
        },
      };

      // mock the jsCodeExecutionEngine to return "node1"
      jsCodeExecutionEngine.execute = jest.fn().mockReturnValue('string');

      // mock the toolExecutionEngine to return "tool1"
      toolExecutionEngine.execute = jest.fn().mockReturnValue('tools');

      await expect(engine.execute(workflow)).resolves.not.toThrow();
      // toolExecutionEngine should be called 1 time
      expect(toolExecutionEngine.execute).toHaveBeenCalledTimes(2);
      // jsCodeExecutionEngine should be called 1 time
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledTimes(1);

      // expect input to be "tools"
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledWith(
        'tools',
        'return "tool1";',
        {
          input: 'tools',
          code: 'return "tool1";',
          nodeId: 'converter',
        },
      );
    });
  });
});
