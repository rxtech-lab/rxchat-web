import { v4 } from 'uuid';
import type {
  BooleanNode,
  ConditionNode,
  ConverterNode,
  FixedInput,
  SkipNode,
  ToolNode,
  UpsertStateNode,
  Workflow,
} from './types';
import {
  type JSCodeExecutionEngine,
  type ToolExecutionEngine,
  WorkflowEngine,
} from './workflow-engine';
import { WorkflowReferenceError } from './errors';
import {
  createTestToolExecutionEngine,
  TestToolExecutionEngine,
} from './engine/testToolExecutionEngine';
import { createJSExecutionEngine } from './engine';
import type { StateClient } from './state/state';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let jsCodeExecutionEngine: JSCodeExecutionEngine;
  let toolExecutionEngine: ToolExecutionEngine;
  let stateClient: StateClient;

  beforeEach(() => {
    jsCodeExecutionEngine = {
      execute: jest.fn(),
    };
    toolExecutionEngine = {
      execute: jest.fn(),
    };
    stateClient = {
      setState: jest.fn(),
      getState: jest.fn(),
      deleteState: jest.fn(),
      clearState: jest.fn(),
      getAllState: jest.fn(),
    };
    engine = new WorkflowEngine(
      jsCodeExecutionEngine,
      toolExecutionEngine,
      stateClient,
    );
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
        expect.anything(),
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
          state: undefined,
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
        { input: 'tools', state: undefined },
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
          firstName: 'John',
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
          firstName: 'John',
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
        output: { fullName: '{{input.firstName}} {{context.lastName}}' },
        child: {
          identifier: v4(),
          type: 'fixed-input',
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
          firstName: 'John',
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
        userName: 'Alice',
        age: 30,
        environment: 'production',
      });

      // Verify that toolExecutionEngine was called
      expect(toolExecutionEngine.execute).toHaveBeenCalledTimes(1);

      // Verify that the tool received the processed output from FixedInput
      expect(toolExecutionEngine.execute).toHaveBeenCalledWith(
        'test-tool',
        {
          processedData: 'Alice is 30 years old',
          userInfo: {
            name: 'Alice',
            age: '30',
            context: 'production',
          },
        },
        undefined,
        undefined,
      );

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
        category: 'users',
        count: 42,
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
        undefined,
        undefined,
      );

      // Verify that jsCodeExecutionEngine was called with ToolNode output
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledTimes(1);
      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledWith(
        {
          input: mockToolResult,
          state: undefined,
        },
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

    it('Should throw error if output refer to non existing context or input', async () => {
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
        output: {
          userInfo: {
            name: '{{input.nonExistingInput}}',
            context: '{{context.nonExistingContext}}',
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

      // Execute the workflow with context that doesn't match the referenced variables
      await expect(
        engine.execute(workflow, {
          // Intentionally not providing nonExistingInput
          someOtherInput: 'value',
          // Intentionally not providing nonExistingContext
          someOtherContext: 'value',
        }),
      ).rejects.toThrow(
        new WorkflowReferenceError(
          'input',
          'nonExistingInput',
          expect.any(String),
        ),
      );
    });

    it('Should throw error if output refer to non existing context', async () => {
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
        output: {
          userInfo: {
            context: '{{context.nonExistingContext}}',
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

      await expect(
        engine.execute(workflow, {
          // No nonExistingContext provided
          someOtherContext: 'value',
        }),
      ).rejects.toThrow(
        new WorkflowReferenceError(
          'context',
          'nonExistingContext',
          expect.any(String),
        ),
      );
    });
  });

  describe('FixedInput to ConverterNode Integration', () => {
    beforeEach(() => {
      process.env.MCP_ROUTER_SERVER_URL = 'http://localhost:3000';
      process.env.MCP_ROUTER_SERVER_API_KEY = 'test-api-key';
    });
    it('Should be able to pass FixedInput output to ConverterNode', async () => {
      const converterNode: ConverterNode = {
        identifier: 'fd55a028-6db0-45d9-b1d7-00859e38363e',
        type: 'converter',
        code: 'async function handle(input) {\n  return {\n    "message": `BTCUSDT price: ${input.input.price.price}`,\n    "chat_id": 12345\n  }\n}',
        child: null,
        runtime: 'js',
      };

      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: '2802be26-8827-4625-8529-ac363c0cb5fd',
        output: {
          endpoint: 'PRICE',
          price: {
            symbol: 'BTCUSDT',
          },
        },
        child: converterNode,
      };

      const workflow: Workflow = {
        title: 'FixedInput to ConverterNode Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: fixedInput,
        },
      };

      const engine = new WorkflowEngine(
        createJSExecutionEngine(),
        createTestToolExecutionEngine(),
        stateClient,
      );

      const result = await engine.execute(workflow);
      expect(result).toEqual({
        message: 'BTCUSDT price: undefined',
        chat_id: 12345,
      });
    });

    it('Should be able to pass converter output to fixed input', async () => {
      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: '2802be26-8827-4625-8529-ac363c0cb5fd',
        output: {
          message: '{{input}}',
        },
        child: null,
      };
      const converterNode: ConverterNode = {
        identifier: 'fd55a028-6db0-45d9-b1d7-00859e38363e',
        type: 'converter',
        code: 'async function handle(input) {\n  return "hello world"; \n}',
        child: fixedInput,
        runtime: 'js',
      };

      const workflow: Workflow = {
        title: 'FixedInput to ConverterNode Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: converterNode,
        },
      };

      const engine = new WorkflowEngine(
        createJSExecutionEngine(),
        createTestToolExecutionEngine(),
        stateClient,
      );

      const result = await engine.execute(workflow);
      expect(result).toEqual({
        message: 'hello world',
      });
    });
  });

  describe('Fixed input should show error if referencing a non existing context', () => {
    it('Should show error if referencing a non existing context', async () => {
      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: v4(),
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
          firstName: 'John',
        }),
      ).rejects.toThrow(
        new WorkflowReferenceError('context', 'lastName', expect.any(String)),
      );
    });

    it('Should show error if referencing a context property with null value', async () => {
      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: v4(),
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
          firstName: 'John',
          lastName: null,
        }),
      ).rejects.toThrow(
        new WorkflowReferenceError('context', 'lastName', expect.any(String)),
      );
    });
  });

  describe('SkipNode Execution', () => {
    it('should execute skip node and terminate workflow with input value', async () => {
      const skipNode: SkipNode = {
        identifier: 'skip-node',
        type: 'skip',
        child: null,
      };

      const toolNode: ToolNode = {
        identifier: 'pre-skip-tool',
        type: 'tool',
        toolIdentifier: 'test-tool',
        description: 'Tool before skip',
        child: skipNode,
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
      };

      const workflow: Workflow = {
        title: 'Skip Node Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: toolNode,
        },
      };

      // Mock tool execution to return a specific value
      const toolOutput = { success: true, data: 'processed data' };
      (toolExecutionEngine.execute as jest.Mock).mockResolvedValue(toolOutput);

      const result = await engine.execute(workflow, { initialData: 'test' });

      // Tool should have been executed (with trigger output, not workflow context)
      expect(toolExecutionEngine.execute).toHaveBeenCalledWith(
        'test-tool',
        {},
        toolNode.inputSchema,
        toolNode.outputSchema,
      );

      // Skip node should terminate the workflow and return the tool output
      expect(result).toEqual(toolOutput);
    });

    it('should skip node with child should not execute child', async () => {
      const postSkipTool: ToolNode = {
        identifier: 'post-skip-tool',
        type: 'tool',
        toolIdentifier: 'should-not-execute',
        description: 'Tool after skip (should not execute)',
        child: null,
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
      };

      const skipNode: SkipNode = {
        identifier: 'skip-node',
        type: 'skip',
        child: postSkipTool, // This should not be executed
      };

      const workflow: Workflow = {
        title: 'Skip Node with Child Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: skipNode,
        },
      };

      const result = await engine.execute(workflow, { skipInput: 'test data' });

      // Skip node should terminate and return trigger output (empty object)
      expect(result).toEqual({});

      // Post-skip tool should not have been executed
      expect(toolExecutionEngine.execute).not.toHaveBeenCalledWith(
        'should-not-execute',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should handle skip node in boolean branch', async () => {
      const skipNode: SkipNode = {
        identifier: 'skip-node',
        type: 'skip',
        child: null,
      };

      const normalTool: ToolNode = {
        identifier: 'normal-tool',
        type: 'tool',
        toolIdentifier: 'normal-tool',
        description: 'Normal tool for false branch',
        child: null,
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
      };

      const booleanNode: BooleanNode = {
        identifier: 'boolean-node',
        type: 'boolean',
        runtime: 'js',
        code: 'async function handle(input) { return input.shouldSkip; }',
        trueChild: skipNode,
        falseChild: normalTool,
      };

      const workflow: Workflow = {
        title: 'Boolean Skip Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: booleanNode,
        },
      };

      // Test true branch (should skip)
      (jsCodeExecutionEngine.execute as jest.Mock).mockReturnValue(true);

      const resultTrue = await engine.execute(workflow, { shouldSkip: true });

      // Should return input to skip node (which is undefined from boolean node)
      expect(resultTrue).toBeUndefined();

      // Normal tool should not have been executed
      expect(toolExecutionEngine.execute).not.toHaveBeenCalledWith(
        'normal-tool',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('UpsertStateNode Execution', () => {
    it('should execute upsert state node and store value in state client', async () => {
      const upsertStateNode: UpsertStateNode = {
        identifier: 'upsert-state-node',
        type: 'upsert-state',
        key: 'testKey',
        value: { message: 'Hello World', count: 42 },
        child: null,
      };

      const workflow: Workflow = {
        title: 'Upsert State Node Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: upsertStateNode,
        },
      };

      (stateClient.setState as jest.Mock).mockResolvedValue(undefined);

      const result = await engine.execute(workflow);

      expect(stateClient.setState).toHaveBeenCalledWith('testKey', {
        message: 'Hello World',
        count: 42,
      });
      expect(result).toEqual({ message: 'Hello World', count: 42 });
    });

    it('should execute upsert state node with string value', async () => {
      const upsertStateNode: UpsertStateNode = {
        identifier: 'upsert-state-node',
        type: 'upsert-state',
        key: 'stringKey',
        value: 'simple string value',
        child: null,
      };

      const workflow: Workflow = {
        title: 'Upsert State Node String Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: upsertStateNode,
        },
      };

      (stateClient.setState as jest.Mock).mockResolvedValue(undefined);

      const result = await engine.execute(workflow);

      expect(stateClient.setState).toHaveBeenCalledWith(
        'stringKey',
        'simple string value',
      );
      expect(result).toEqual('simple string value');
    });

    it('should execute upsert state node with complex nested object', async () => {
      const complexValue = {
        user: {
          id: 123,
          profile: {
            name: 'John Doe',
            settings: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
        metadata: {
          timestamp: 1234567890,
          version: '2.0',
        },
      };

      const upsertStateNode: UpsertStateNode = {
        identifier: 'upsert-state-node',
        type: 'upsert-state',
        key: 'complexObject',
        value: complexValue,
        child: null,
      };

      const workflow: Workflow = {
        title: 'Upsert State Node Complex Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: upsertStateNode,
        },
      };

      (stateClient.setState as jest.Mock).mockResolvedValue(undefined);

      const result = await engine.execute(workflow);

      expect(stateClient.setState).toHaveBeenCalledWith(
        'complexObject',
        complexValue,
      );
      expect(result).toEqual(complexValue);
    });

    it('should handle upsert state node as child of boolean node', async () => {
      const upsertStateNodeTrue: UpsertStateNode = {
        identifier: 'upsert-state-node-true',
        type: 'upsert-state',
        key: 'trueKey',
        value: { condition: 'true_branch' },
        child: null,
      };

      const upsertStateNodeFalse: UpsertStateNode = {
        identifier: 'upsert-state-node-false',
        type: 'upsert-state',
        key: 'falseKey',
        value: { condition: 'false_branch' },
        child: null,
      };

      const booleanNode: BooleanNode = {
        identifier: 'boolean-node',
        type: 'boolean',
        runtime: 'js',
        code: 'return input.shouldUseTrue;',
        trueChild: upsertStateNodeTrue,
        falseChild: upsertStateNodeFalse,
      };

      const workflow: Workflow = {
        title: 'Boolean to Upsert State Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: booleanNode,
        },
      };

      (jsCodeExecutionEngine.execute as jest.Mock).mockReturnValue(false);
      (stateClient.setState as jest.Mock).mockResolvedValue(undefined);

      const result = await engine.execute(workflow, { shouldUseTrue: false });

      expect(jsCodeExecutionEngine.execute).toHaveBeenCalledWith(
        {},
        'return input.shouldUseTrue;',
        { nodeId: 'boolean-node' },
      );
      expect(stateClient.setState).toHaveBeenCalledWith('falseKey', {
        condition: 'false_branch',
      });
      expect(result).toEqual({ condition: 'false_branch' });
    });

    it('should throw error when state client setState fails', async () => {
      const upsertStateNode: UpsertStateNode = {
        identifier: 'upsert-state-node',
        type: 'upsert-state',
        key: 'errorKey',
        value: { test: 'data' },
        child: null,
      };

      const workflow: Workflow = {
        title: 'Upsert State Node Error Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: upsertStateNode,
        },
      };

      const stateError = new Error('State write access denied');
      (stateClient.setState as jest.Mock).mockRejectedValue(stateError);

      await expect(engine.execute(workflow)).rejects.toThrow(
        "Upsert state node 'upsert-state-node' execution failed: State write access denied",
      );

      expect(stateClient.setState).toHaveBeenCalledWith('errorKey', {
        test: 'data',
      });
    });

    it('should handle multiple upsert state nodes in sequence', async () => {
      const secondUpsertStateNode: UpsertStateNode = {
        identifier: 'second-upsert-state-node',
        type: 'upsert-state',
        key: 'secondKey',
        value: { step: 2, action: 'final' },
        child: null,
      };

      const firstUpsertStateNode: UpsertStateNode = {
        identifier: 'first-upsert-state-node',
        type: 'upsert-state',
        key: 'firstKey',
        value: { step: 1, action: 'initial' },
        child: secondUpsertStateNode,
      };

      const workflow: Workflow = {
        title: 'Multiple Upsert State Nodes Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: firstUpsertStateNode,
        },
      };

      (stateClient.setState as jest.Mock).mockResolvedValue(undefined);

      const result = await engine.execute(workflow);

      expect(stateClient.setState).toHaveBeenCalledTimes(2);
      expect(stateClient.setState).toHaveBeenNthCalledWith(1, 'firstKey', {
        step: 1,
        action: 'initial',
      });
      expect(stateClient.setState).toHaveBeenNthCalledWith(2, 'secondKey', {
        step: 2,
        action: 'final',
      });
      expect(result).toEqual({ step: 2, action: 'final' });
    });

    it('should handle upsert state node with FixedInput child that can reference the stored value', async () => {
      const fixedInput: FixedInput = {
        identifier: 'fixed-input-node',
        type: 'fixed-input',
        output: {
          message: 'Stored user {{input.name}} with status {{input.status}}',
          processed: true,
        },
        child: null,
      };

      const upsertStateNode: UpsertStateNode = {
        identifier: 'upsert-state-node',
        type: 'upsert-state',
        key: 'userInfo',
        value: { name: 'Alice', status: 'active' },
        child: fixedInput,
      };

      const workflow: Workflow = {
        title: 'Upsert State to FixedInput Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: upsertStateNode,
        },
      };

      (stateClient.setState as jest.Mock).mockResolvedValue(undefined);

      const result = await engine.execute(workflow);

      expect(stateClient.setState).toHaveBeenCalledWith('userInfo', {
        name: 'Alice',
        status: 'active',
      });
      expect(result).toEqual({
        message: 'Stored user Alice with status active',
        processed: true,
      });
    });
  });
});

describe('Workflow Engine with test ToolExecutionEngine', () => {
  let engine: WorkflowEngine;
  let jsCodeExecutionEngine: JSCodeExecutionEngine;
  let toolExecutionEngine: TestToolExecutionEngine;
  let stateClient: StateClient;

  beforeEach(() => {
    process.env.MCP_ROUTER_SERVER_URL = 'http://localhost:3000';
    process.env.MCP_ROUTER_SERVER_API_KEY = 'test-api-key';
    jsCodeExecutionEngine = {
      execute: jest.fn(),
    };
    toolExecutionEngine = new TestToolExecutionEngine();
    stateClient = {
      setState: jest.fn(),
      getState: jest.fn(),
      deleteState: jest.fn(),
      clearState: jest.fn(),
      getAllState: jest.fn(),
    };
    engine = new WorkflowEngine(
      jsCodeExecutionEngine,
      toolExecutionEngine,
      stateClient,
    );
  });

  describe('Fixed Input', () => {
    it('Should be able to execute a workflow with fixed input', async () => {
      const fixedInput: FixedInput = {
        type: 'fixed-input',
        identifier: v4(),
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
          firstName: 'John',
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
          firstName: 'John',
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
        output: { fullName: '{{input.firstName}} {{context.lastName}}' },
        child: {
          identifier: v4(),
          type: 'fixed-input',
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
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).resolves.toStrictEqual({
        fullName: 'John Doe',
      });
    });
  });

  describe('real workflow', () => {
    it('should be able to execute a real notification workflow with converter node', async () => {
      const workflow = {
        title: 'New Workflow',
        trigger: {
          type: 'cronjob-trigger',
          identifier: '2802be26-8827-4625-8529-ac363c0cb5fd',
          cron: '*/10 * * * *',
          child: {
            identifier: '0acaea6e-eb30-476d-8198-4e128afc2500',
            type: 'fixed-input',
            output: {
              endpoint: 'PRICE',
              price: {
                symbol: 'BTCUSDT',
              },
            },
            child: {
              identifier: '66ebe3cc-f5cc-4acd-a559-9cce11248d9c',
              type: 'tool',
              toolIdentifier: 'binance',
              child: {
                identifier: 'fd55a028-6db0-45d9-b1d7-00859e38363e',
                type: 'converter',
                code: 'async function handle(input) {\n  return `BTCUSDT price: ${input.price}`;\n}',
                runtime: 'js',
                child: {
                  type: 'fixed-input',
                  identifier: v4(),
                  output: {
                    message: '{{input}}',
                    chat_id: '{{context.telegramChatId}}',
                    child: {
                      identifier: 'b8c33ba5-5255-4e1d-9892-f92ab8d28a08',
                      type: 'tool',
                      toolIdentifier: 'telegram-bot',
                      child: null,
                      description:
                        '\n\t\tTelegram Bot is a tool that allows you to send messages to Telegram chats.\n\t\tYou can use this tool to send messages in Markdown format to any chat where the bot has access.\n\t\t',
                      inputSchema: {
                        $id: 'https://github.com/wyt-labs/mcp-router/plugins/telegram-bot/telegram/send-message-input',
                        $schema: 'https://json-schema.org/draft/2020-12/schema',
                        additionalProperties: false,
                        properties: {
                          chat_id: {
                            description: 'Chat ID',
                            type: 'integer',
                          },
                          message: {
                            description: 'Message text in markdown format',
                            type: 'string',
                          },
                        },
                        required: ['message', 'chat_id'],
                        type: 'object',
                      },
                      outputSchema: {
                        $id: 'https://github.com/wyt-labs/mcp-router/plugins/telegram-bot/telegram/send-message-output',
                        $schema: 'https://json-schema.org/draft/2020-12/schema',
                        additionalProperties: false,
                        properties: {
                          error: {
                            description: 'Error message if the request failed',
                            type: 'string',
                          },
                        },
                        type: 'object',
                      },
                    },
                  },
                } as FixedInput,
              },
              description: 'Access cryptocurrency price data via Binance API',
              inputSchema: {
                $schema: 'https://json-schema.org/draft/2020-12/schema',
                additionalProperties: false,
                properties: {
                  endpoint: {
                    enum: ['TICKER_24HR', 'PRICE'],
                    type: 'string',
                  },
                  headers: {
                    additionalProperties: {
                      type: 'string',
                    },
                    description: 'Custom headers for the HTTP request',
                    type: 'object',
                  },
                  price: {
                    additionalProperties: false,
                    description: 'Input for PRICE endpoint',
                    properties: {
                      symbol: {
                        description: 'Trading pair symbol (e.g.',
                        type: 'string',
                      },
                    },
                    type: 'object',
                  },
                  ticker_24hr: {
                    additionalProperties: false,
                    description: 'Input for TICKER_24HR endpoint',
                    properties: {
                      symbol: {
                        description: 'Trading pair symbol (e.g.',
                        type: 'string',
                      },
                    },
                    type: 'object',
                  },
                },
                required: ['endpoint'],
                type: 'object',
              },
              outputSchema: {
                $schema: 'https://json-schema.org/draft/2020-12/schema',
                additionalProperties: false,
                properties: {
                  data: {
                    description: 'Response data from Binance API',
                    type: 'object',
                    properties: {
                      price: {
                        type: 'string',
                        description: 'Current price of the trading pair',
                      },
                    },
                  },
                  error: {
                    description: 'Error message if the request failed',
                    type: 'string',
                  },
                },
                required: ['data'],
                type: 'object',
              },
            },
          },
        },
      };

      const engine = new WorkflowEngine(
        createJSExecutionEngine(),
        toolExecutionEngine,
        stateClient,
      );

      await engine.execute(workflow as any, {
        telegramChatId: 12345,
      });
      expect(toolExecutionEngine);
    });
  });

  describe('BooleanNode Execution', () => {
    beforeEach(() => {
      process.env.MCP_ROUTER_SERVER_URL = 'http://localhost:3000';
      process.env.MCP_ROUTER_SERVER_API_KEY = 'test-api-key';
    });

    it('should execute true branch when boolean node returns true', async () => {
      const trueTool: ToolNode = {
        identifier: 'true-tool',
        type: 'tool',
        toolIdentifier: 'true-tool',
        description: 'Tool executed on true path',
        child: null,
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
      };

      const falseTool: ToolNode = {
        identifier: 'false-tool',
        type: 'tool',
        toolIdentifier: 'false-tool',
        description: 'Tool executed on false path',
        child: null,
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
      };

      const booleanNode: BooleanNode = {
        identifier: 'boolean-node',
        type: 'boolean',
        runtime: 'js',
        code: 'async function handle(input) { return input.value > 50; }',
        trueChild: trueTool,
        falseChild: falseTool,
      };

      const workflow: Workflow = {
        title: 'Boolean Node Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: booleanNode,
        },
      };

      // Mock the JS engine to return true
      (jsCodeExecutionEngine.execute as jest.Mock).mockReturnValue(true);

      const result = await engine.execute(workflow, { value: 75 });

      // Should execute the true branch tool - check that it was called
      expect(toolExecutionEngine.getCallCount('true-tool')).toBe(1);
      // The result should be from the test tool execution engine
      expect(result).toBeDefined();
    });

    it('should execute false branch when boolean node returns false', async () => {
      const trueTool: ToolNode = {
        identifier: 'true-tool',
        type: 'tool',
        toolIdentifier: 'true-tool',
        description: 'Tool executed on true path',
        child: null,
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
      };

      const falseTool: ToolNode = {
        identifier: 'false-tool',
        type: 'tool',
        toolIdentifier: 'false-tool',
        description: 'Tool executed on false path',
        child: null,
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
      };

      const booleanNode: BooleanNode = {
        identifier: 'boolean-node',
        type: 'boolean',
        runtime: 'js',
        code: 'async function handle(input) { return input.value > 50; }',
        trueChild: trueTool,
        falseChild: falseTool,
      };

      const workflow: Workflow = {
        title: 'Boolean Node Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: booleanNode,
        },
      };

      // Mock the JS engine to return false
      (jsCodeExecutionEngine.execute as jest.Mock).mockReturnValue(false);

      const result = await engine.execute(workflow, { value: 25 });

      // Should execute the false branch tool
      expect(toolExecutionEngine.getCallCount('false-tool')).toBe(1);
      expect(result).toBeDefined();
    });

    it('should terminate workflow when boolean node has no appropriate child', async () => {
      const trueTool: ToolNode = {
        identifier: 'true-tool',
        type: 'tool',
        toolIdentifier: 'true-tool',
        description: 'Tool executed on true path',
        child: null,
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
      };

      const booleanNode: BooleanNode = {
        identifier: 'boolean-node',
        type: 'boolean',
        runtime: 'js',
        code: 'async function handle(input) { return input.value > 50; }',
        trueChild: trueTool,
        falseChild: null, // No false child
      };

      const workflow: Workflow = {
        title: 'Boolean Node Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: booleanNode,
        },
      };

      // Mock the JS engine to return false (but there's no false child)
      (jsCodeExecutionEngine.execute as jest.Mock).mockReturnValue(false);

      const result = await engine.execute(workflow, { value: 25 });

      // Should not execute any tool since there's no false child
      expect(toolExecutionEngine.getCallCount('false-tool')).toBe(0);
      expect(toolExecutionEngine.getCallCount('true-tool')).toBe(0);
      // Should return the boolean result as the last executed output
      expect(result).toBe(false);
    });

    it('should handle nested boolean nodes', async () => {
      const finalTool: ToolNode = {
        identifier: 'final-tool',
        type: 'tool',
        toolIdentifier: 'final-tool',
        description: 'Final tool in nested structure',
        child: null,
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
      };

      const innerBooleanNode: BooleanNode = {
        identifier: 'inner-boolean',
        type: 'boolean',
        runtime: 'js',
        code: 'async function handle(input) { return input.secondCheck; }',
        trueChild: finalTool,
        falseChild: null,
      };

      const outerBooleanNode: BooleanNode = {
        identifier: 'outer-boolean',
        type: 'boolean',
        runtime: 'js',
        code: 'async function handle(input) { return input.firstCheck; }',
        trueChild: innerBooleanNode,
        falseChild: null,
      };

      const workflow: Workflow = {
        title: 'Nested Boolean Node Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: outerBooleanNode,
        },
      };

      // Mock the JS engine to return true for both boolean nodes
      (jsCodeExecutionEngine.execute as jest.Mock)
        .mockReturnValueOnce(true) // First call (outer boolean)
        .mockReturnValueOnce(true); // Second call (inner boolean)

      const result = await engine.execute(workflow, {
        firstCheck: true,
        secondCheck: true,
      });

      // Should execute the final tool
      expect(toolExecutionEngine.getCallCount('final-tool')).toBe(1);
      expect(result).toBeDefined();
    });

    it('should throw error when boolean node execution fails', async () => {
      const booleanNode: BooleanNode = {
        identifier: 'boolean-node',
        type: 'boolean',
        runtime: 'js',
        code: 'async function handle(input) { throw new Error("Execution failed"); }',
        trueChild: null,
        falseChild: null,
      };

      const workflow: Workflow = {
        title: 'Failing Boolean Node Workflow',
        trigger: {
          identifier: 'test-trigger',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: booleanNode,
        },
      };

      // Mock the JS engine to throw an error
      (jsCodeExecutionEngine.execute as jest.Mock).mockImplementation(() => {
        throw new Error('Execution failed');
      });

      await expect(engine.execute(workflow)).rejects.toThrow(
        "Boolean node 'boolean-node' execution failed: Execution failed",
      );
    });
  });
});
