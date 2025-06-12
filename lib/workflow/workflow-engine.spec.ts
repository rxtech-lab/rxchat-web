import { v4 } from 'uuid';
import type {
  ConditionNode,
  ConverterNode,
  FixedInput,
  ToolNode,
  Workflow,
} from './types';
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

  describe('Fixed Input', () => {
    it('Should be able to execute a workflow with fixed input', async () => {
      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: v4(),
        input: { firstName: 'John' },
        output: { fullName: '{{input.firstName}} {{context.lastName}}' },
        child: null,
      };

      const workflow: Workflow = {
        title: 'Fixed Input Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      await expect(
        engine.execute(workflow, {
          lastName: 'Doe',
        }),
      ).resolves.toStrictEqual({
        fullName: 'John Doe',
      });
    });

    it('Should be able to execute a workflow with fixed input with nested object', async () => {
      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: v4(),
        input: { firstName: 'John' },
        output: { name: { full: '{{input.firstName}} {{context.lastName}}' } },
        child: null,
      };

      const workflow: Workflow = {
        title: 'Fixed Input Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      await expect(
        engine.execute(workflow, {
          lastName: 'Doe',
        }),
      ).resolves.toStrictEqual({
        name: {
          full: 'John Doe',
        },
      });
    });

    it('Should be able pass fixed input output to next input', async () => {
      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: v4(),
        input: { firstName: 'John' },
        output: { fullName: '{{input.firstName}} {{context.lastName}}' },
        child: {
          identifier: v4(),
          type: 'fixed-input',
          input: null,
          output: {
            fullName: '{{input.fullName}}',
          },
          child: null,
        } as FixedInput, // Assuming the next node is a ToolNode
      };

      const workflow: Workflow = {
        title: 'Fixed Input Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      await expect(
        engine.execute(workflow, {
          lastName: 'Doe',
        }),
      ).resolves.toStrictEqual({
        fullName: 'John Doe',
      });
    });
  });

  describe('FixedInput to ToolNode Integration', () => {
    it('Should pass FixedInput output to ToolNode as input', async () => {
      const toolNode: ToolNode = {
        identifier: 'tool-node',
        type: 'tool',
        toolIdentifier: 'test-tool',
        description: 'Test tool that receives fixed input output',
        child: null,
      };

      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: 'fixed-input-node',
        input: { userName: 'Alice', age: 30 },
        output: {
          processedData: '{{input.userName}} is {{input.age}} years old',
          userInfo: {
            name: '{{input.userName}}',
            age: '{{input.age}}',
            context: '{{context.environment}}',
          },
        },
        child: toolNode,
      };

      const workflow: Workflow = {
        title: 'FixedInput to ToolNode Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      // Mock the toolExecutionEngine to return some result
      const mockToolResult = {
        success: true,
        result: 'Tool executed successfully',
      };
      toolExecutionEngine.execute = jest.fn().mockReturnValue(mockToolResult);

      // Execute the workflow with context
      const result = await engine.execute(workflow, {
        environment: 'production',
      });

      // Verify that toolExecutionEngine was called
      expect(toolExecutionEngine.execute).toHaveBeenCalledTimes(1);

      // Verify that the tool received the processed output from FixedInput
      expect(toolExecutionEngine.execute).toHaveBeenCalledWith('test-tool', {
        processedData: 'Alice is 30 years old',
        userInfo: {
          name: 'Alice',
          age: '30',
          context: 'production',
        },
      });

      // Verify the final result is from the tool
      expect(result).toEqual(mockToolResult);
    });

    it('Should pass data through FixedInput → ToolNode → ConverterNode sequence', async () => {
      const converterNode: ConverterNode = {
        identifier: 'converter-node',
        type: 'converter',
        code: 'return { convertedResult: `Processed: ${input.result}`, originalSuccess: input.success };',
        runtime: 'js',
        child: null,
      };

      const toolNode: ToolNode = {
        identifier: 'tool-node',
        type: 'tool',
        toolIdentifier: 'data-processor',
        description: 'Tool that processes fixed input data',
        child: converterNode,
      };

      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: 'fixed-input-node',
        input: { category: 'users', count: 42 },
        output: {
          processType: '{{input.category}}_processing',
          itemCount: '{{input.count}}',
          environment: '{{context.env}}',
        },
        child: toolNode,
      };

      const workflow: Workflow = {
        title: 'FixedInput → ToolNode → ConverterNode Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      // Mock the toolExecutionEngine to return processed data
      const mockToolResult = {
        success: true,
        result: 'users_processing completed with 42 items in staging',
      };
      toolExecutionEngine.execute = jest.fn().mockReturnValue(mockToolResult);

      // Mock the jsCodeExecutionEngine for the converter
      const mockConverterResult = {
        convertedResult:
          'Processed: users_processing completed with 42 items in staging',
        originalSuccess: true,
      };
      jsCodeExecutionEngine.execute = jest
        .fn()
        .mockReturnValue(mockConverterResult);

      // Execute the workflow with context
      const result = await engine.execute(workflow, {
        env: 'staging',
      });

      // Verify that toolExecutionEngine was called with FixedInput output
      expect(toolExecutionEngine.execute).toHaveBeenCalledTimes(1);
      expect(toolExecutionEngine.execute).toHaveBeenCalledWith(
        'data-processor',
        {
          processType: 'users_processing',
          itemCount: '42',
          environment: 'staging',
        },
      );

      // Verify that jsCodeExecutionEngine was called with ToolNode output
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledTimes(1);
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledWith(
        mockToolResult,
        'return { convertedResult: `Processed: ${input.result}`, originalSuccess: input.success };',
        {
          input: mockToolResult,
          code: 'return { convertedResult: `Processed: ${input.result}`, originalSuccess: input.success };',
          nodeId: 'converter-node',
        },
      );

      // Verify the final result is from the converter
      expect(result).toEqual(mockConverterResult);
    });
  });
});
