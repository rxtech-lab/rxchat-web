import { v4 as uuidv4 } from 'uuid';
import { compileCode } from '../agent/runtime/runner-environment';
import type { McpRouter } from '../router/mcpRouter';
import { TodoList } from './todolist/todolist';
import type {
  BooleanNode,
  ConditionNode,
  ConverterNode,
  FixedInput,
  SkipNode,
  ToolNode,
  UpsertStateNode,
} from './types';
import {
  addBooleanFalseChildTool,
  addBooleanNodeTool,
  addBooleanTrueChildTool,
  addConditionTool,
  addConverterTool,
  addInputTool,
  addSkipNodeTool,
  addTodoListItemsTool,
  addToolNodeTool,
  addUpsertStateNodeTool,
  compileTool,
  markAsComplete,
  modifyToolNode,
  modifyTriggerTool,
  removeNodeTool,
  swapNodesTool,
  viewWorkflow,
} from './workflow-tools';

// Mock external dependencies
jest.mock('../agent/runtime/runner-environment');
jest.mock('uuid');

describe('WorkflowTools', () => {
  let mockWorkflow: any;
  let mockTodoList: jest.Mocked<TodoList>;
  let mockMcpRouter: jest.Mocked<McpRouter>;
  let mockCompileCode: jest.MockedFunction<typeof compileCode>;
  let mockUuidv4: jest.MockedFunction<typeof uuidv4>;

  const mockToolInfo = {
    description: 'Test tool description',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
  };

  beforeEach(() => {
    // Setup UUID mock
    mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>;
    mockUuidv4.mockReturnValue('test-uuid-123');

    // Setup compile code mock
    mockCompileCode = compileCode as jest.MockedFunction<typeof compileCode>;
    mockCompileCode.mockResolvedValue('compiled code');

    // Setup MCP router mock
    mockMcpRouter = {
      getToolInfo: jest.fn().mockResolvedValue(mockToolInfo),
    } as any;

    // Setup workflow mock
    mockWorkflow = {
      mcpRouter: mockMcpRouter,
      addAfter: jest.fn(),
      addChild: jest.fn(),
      removeChild: jest.fn(),
      modifyChild: jest.fn(),
      findNode: jest.fn(),
      toViewableString: jest.fn().mockReturnValue('Mock workflow string'),
      compile: jest.fn().mockResolvedValue({}),
      swapNodes: jest.fn(),
      modifyTrigger: jest.fn(),
      getWorkflow: jest.fn().mockReturnValue({ title: 'Test Workflow' }),
    };

    // Setup TodoList mock
    mockTodoList = {
      addItems: jest.fn(),
      markAsCompletedByIndex: jest.fn(),
      toViewableString: jest.fn().mockReturnValue('Mock todo list'),
      items: [],
    } as any;

    // Clear all mocks
    jest.clearAllMocks();

    // Mock console.log to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('addToolNodeTool', () => {
    it('should add tool node successfully with parent id', async () => {
      const tool = addToolNodeTool(mockWorkflow);

      const result = await tool.execute({
        id: 'parent-id',
        toolIdentifier: 'test-tool',
      });

      expect(mockMcpRouter.getToolInfo).toHaveBeenCalledWith('test-tool');
      expect(mockWorkflow.addAfter).toHaveBeenCalledWith(
        'parent-id',
        expect.objectContaining({
          identifier: 'test-uuid-123',
          type: 'tool',
          toolIdentifier: 'test-tool',
          child: null,
          description: mockToolInfo.description,
          inputSchema: mockToolInfo.inputSchema,
          outputSchema: mockToolInfo.outputSchema,
        }),
      );
      expect(result).toBe(
        'Added tool node with identifier test-tool as child of parent-id',
      );
    });

    it('should add tool node at root level when id is null', async () => {
      const tool = addToolNodeTool(mockWorkflow);

      const result = await tool.execute({
        id: null,
        toolIdentifier: 'test-tool',
      });

      expect(mockWorkflow.addAfter).toHaveBeenCalledWith(
        undefined,
        expect.any(Object),
      );
      expect(result).toBe(
        'Added tool node with identifier test-tool as child of root',
      );
    });

    it('should add tool node at root level when id is empty string', async () => {
      const tool = addToolNodeTool(mockWorkflow);

      const result = await tool.execute({
        id: '   ',
        toolIdentifier: 'test-tool',
      });

      expect(mockWorkflow.addAfter).toHaveBeenCalledWith(
        undefined,
        expect.any(Object),
      );
      expect(result).toBe(
        'Added tool node with identifier test-tool as child of    ',
      );
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Tool not found');
      mockMcpRouter.getToolInfo.mockRejectedValue(error);

      const tool = addToolNodeTool(mockWorkflow);

      const result = await tool.execute({
        id: 'parent-id',
        toolIdentifier: 'invalid-tool',
      });

      expect(result).toEqual({ error });
    });
  });

  describe('addConditionTool', () => {
    it('should add condition node successfully', async () => {
      const tool = addConditionTool(mockWorkflow);
      const testCode =
        'export async function handle(input) { return "next-tool"; }';

      const result = await tool.execute({
        toolIdentifier: 'parent-id',
        code: testCode,
      });

      const expectedNode: ConditionNode = {
        identifier: 'test-uuid-123',
        type: 'condition',
        code: testCode,
        runtime: 'js',
        children: [],
      };

      expect(mockWorkflow.addChild).toHaveBeenCalledWith(
        'parent-id',
        expectedNode,
      );
      expect(result).toBe('Added condition node with identifier test-uuid-123');
    });

    it('should add condition node at root when toolIdentifier is null', async () => {
      const tool = addConditionTool(mockWorkflow);
      const testCode =
        'export async function handle(input) { return "next-tool"; }';

      await tool.execute({
        toolIdentifier: null,
        code: testCode,
      });

      expect(mockWorkflow.addChild).toHaveBeenCalledWith(
        undefined,
        expect.any(Object),
      );
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Add child failed');
      mockWorkflow.addChild.mockImplementation(() => {
        throw error;
      });

      const tool = addConditionTool(mockWorkflow);

      const result = await tool.execute({
        toolIdentifier: 'parent-id',
        code: 'test code',
      });

      expect(result).toEqual({ error });
    });
  });

  describe('addBooleanNodeTool', () => {
    it('should add boolean node successfully', async () => {
      const tool = addBooleanNodeTool(mockWorkflow);
      const testCode = 'async function handle(input) { return true; }';

      const result = await tool.execute({
        parentIdentifier: 'parent-id',
        code: testCode,
      });

      const expectedNode: BooleanNode = {
        identifier: 'test-uuid-123',
        type: 'boolean',
        code: testCode,
        runtime: 'js',
        trueChild: null,
        falseChild: null,
      };

      expect(mockWorkflow.addChild).toHaveBeenCalledWith(
        'parent-id',
        expectedNode,
      );
      expect(result).toBe('Added boolean node with identifier test-uuid-123');
    });

    it('should add boolean node at root when parentIdentifier is null', async () => {
      const tool = addBooleanNodeTool(mockWorkflow);

      await tool.execute({
        parentIdentifier: null,
        code: 'async function handle(input) { return true; }',
      });

      expect(mockWorkflow.addChild).toHaveBeenCalledWith(
        undefined,
        expect.any(Object),
      );
    });
  });

  describe('addBooleanTrueChildTool', () => {
    it('should add true child to boolean node successfully', async () => {
      const mockBooleanNode = {
        type: 'boolean',
        trueChild: null,
        falseChild: null,
      };
      mockWorkflow.findNode.mockReturnValue(mockBooleanNode);

      const tool = addBooleanTrueChildTool(mockWorkflow);

      const result = await tool.execute({
        booleanNodeId: 'boolean-node-id',
        childNode: {
          type: 'tool',
          toolIdentifier: 'test-tool',
        },
      });

      expect(mockWorkflow.findNode).toHaveBeenCalledWith('boolean-node-id');
      expect(mockMcpRouter.getToolInfo).toHaveBeenCalledWith('test-tool');
      expect(mockBooleanNode.trueChild).toEqual(
        expect.objectContaining({
          identifier: 'test-uuid-123',
          type: 'tool',
          toolIdentifier: 'test-tool',
        }),
      );
      expect(result).toBe(
        'Added true child node with identifier test-uuid-123 to boolean node boolean-node-id',
      );
    });

    it('should return error when boolean node not found', async () => {
      mockWorkflow.findNode.mockReturnValue(null);

      const tool = addBooleanTrueChildTool(mockWorkflow);

      const result = await tool.execute({
        booleanNodeId: 'non-existent-id',
        childNode: { type: 'skip' },
      });

      expect(result).toBe(
        'Boolean node with identifier non-existent-id not found',
      );
    });

    it('should return error when node is not boolean type', async () => {
      mockWorkflow.findNode.mockReturnValue({ type: 'tool' });

      const tool = addBooleanTrueChildTool(mockWorkflow);

      const result = await tool.execute({
        booleanNodeId: 'tool-node-id',
        childNode: { type: 'skip' },
      });

      expect(result).toBe(
        'Boolean node with identifier tool-node-id not found',
      );
    });

    it('should return error when true child already exists', async () => {
      const mockBooleanNode = {
        type: 'boolean',
        trueChild: { type: 'tool' },
        falseChild: null,
      };
      mockWorkflow.findNode.mockReturnValue(mockBooleanNode);

      const tool = addBooleanTrueChildTool(mockWorkflow);

      const result = await tool.execute({
        booleanNodeId: 'boolean-node-id',
        childNode: { type: 'skip' },
      });

      expect(result).toBe(
        'Boolean node boolean-node-id already has a true child',
      );
    });
  });

  describe('addBooleanFalseChildTool', () => {
    it('should add false child to boolean node successfully', async () => {
      const mockBooleanNode = {
        type: 'boolean',
        trueChild: null,
        falseChild: null,
      };
      mockWorkflow.findNode.mockReturnValue(mockBooleanNode);

      const tool = addBooleanFalseChildTool(mockWorkflow);

      const result = await tool.execute({
        booleanNodeId: 'boolean-node-id',
        childNode: {
          type: 'converter',
          code: 'async function handle(input) { return input; }',
        },
      });

      expect(mockBooleanNode.falseChild).toEqual(
        expect.objectContaining({
          identifier: 'test-uuid-123',
          type: 'converter',
          code: 'async function handle(input) { return input; }',
        }),
      );
      expect(result).toBe(
        'Added false child node with identifier test-uuid-123 to boolean node boolean-node-id',
      );
    });

    it('should return error when false child already exists', async () => {
      const mockBooleanNode = {
        type: 'boolean',
        trueChild: null,
        falseChild: { type: 'tool' },
      };
      mockWorkflow.findNode.mockReturnValue(mockBooleanNode);

      const tool = addBooleanFalseChildTool(mockWorkflow);

      const result = await tool.execute({
        booleanNodeId: 'boolean-node-id',
        childNode: { type: 'skip' },
      });

      expect(result).toBe(
        'Boolean node boolean-node-id already has a false child',
      );
    });
  });

  describe('addConverterTool', () => {
    it('should add converter node successfully', async () => {
      const tool = addConverterTool(mockWorkflow);
      const testCode = 'async function handle(input) { return input.input; }';

      const result = await tool.execute({
        toolIdentifier: 'parent-id',
        code: testCode,
      });

      expect(mockCompileCode).toHaveBeenCalledWith(testCode, 'typescript');
      expect(mockWorkflow.addAfter).toHaveBeenCalledWith(
        'parent-id',
        expect.objectContaining({
          identifier: 'test-uuid-123',
          type: 'converter',
          code: testCode,
          child: null,
          runtime: 'js',
        }),
      );
      expect(result).toBe('Added converter node with identifier test-uuid-123');
    });

    it('should handle compilation errors', async () => {
      const error = new Error('Compilation failed');
      mockCompileCode.mockRejectedValue(error);

      const tool = addConverterTool(mockWorkflow);

      const result = await tool.execute({
        toolIdentifier: 'parent-id',
        code: 'invalid code',
      });

      expect(result).toEqual({ error });
    });
  });

  describe('removeNodeTool', () => {
    it('should remove node successfully', async () => {
      const tool = removeNodeTool(mockWorkflow);

      const result = await tool.execute({
        identifier: 'node-to-remove',
      });

      expect(mockWorkflow.removeChild).toHaveBeenCalledWith('node-to-remove');
      expect(result).toBe('Removed node with identifier node-to-remove');
    });

    it('should handle removal errors', async () => {
      const error = new Error('Node not found');
      mockWorkflow.removeChild.mockImplementation(() => {
        throw error;
      });

      const tool = removeNodeTool(mockWorkflow);

      const result = await tool.execute({
        identifier: 'non-existent-node',
      });

      expect(result).toEqual({ error });
    });
  });

  describe('modifyToolNode', () => {
    it('should modify tool node successfully', async () => {
      const existingNode = {
        identifier: 'existing-id',
        type: 'tool',
        child: { type: 'converter' },
      };
      mockWorkflow.findNode.mockReturnValue(existingNode);

      const tool = modifyToolNode(mockWorkflow);

      const result = await tool.execute({
        id: 'existing-id',
        node: { toolIdentifier: 'new-tool' },
      });

      expect(mockWorkflow.findNode).toHaveBeenCalledWith('existing-id');
      expect(mockWorkflow.modifyChild).toHaveBeenCalledWith('existing-id', {
        identifier: 'existing-id',
        type: 'tool',
        toolIdentifier: 'new-tool',
        child: existingNode.child,
      });
      expect(result).toBe(
        'Modified tool node with identifier existing-id to new-tool',
      );
    });

    it('should handle modification errors', async () => {
      const error = new Error('Modification failed');
      mockWorkflow.modifyChild.mockImplementation(() => {
        throw error;
      });

      const tool = modifyToolNode(mockWorkflow);

      const result = await tool.execute({
        id: 'node-id',
        node: { toolIdentifier: 'new-tool' },
      });

      expect(result).toEqual({ error });
    });
  });

  describe('compileTool', () => {
    it('should compile workflow successfully', async () => {
      const tool = compileTool(mockWorkflow);

      const result = await tool.execute({});

      expect(mockWorkflow.compile).toHaveBeenCalled();
      expect(result).toBe('Workflow compiled successfully');
    });

    it('should handle compilation errors', async () => {
      const error = new Error('Compilation failed');
      mockWorkflow.compile.mockRejectedValue(error);

      const tool = compileTool(mockWorkflow);

      const result = await tool.execute({});

      expect(result).toEqual({ error });
    });
  });

  describe('viewWorkflow', () => {
    it('should return workflow data', async () => {
      const mockWorkflowData = { title: 'Test Workflow', trigger: {} };
      mockWorkflow.getWorkflow.mockReturnValue(mockWorkflowData);

      const tool = viewWorkflow(mockWorkflow);

      const result = await tool.execute({});

      expect(mockWorkflow.getWorkflow).toHaveBeenCalled();
      expect(result).toEqual(mockWorkflowData);
    });
  });

  describe('modifyTriggerTool', () => {
    it('should modify trigger successfully', async () => {
      const tool = modifyTriggerTool(mockWorkflow);
      const cronExpression = '0 0 * * *';

      const result = await tool.execute({
        cron: cronExpression,
      });

      expect(mockWorkflow.modifyTrigger).toHaveBeenCalledWith({
        type: 'cronjob-trigger',
        identifier: 'test-uuid-123',
        cron: cronExpression,
      });
      expect(result).toEqual({ title: 'Test Workflow' });
    });

    it('should handle trigger modification errors', async () => {
      const error = new Error('Invalid cron expression');
      mockWorkflow.modifyTrigger.mockImplementation(() => {
        throw error;
      });

      const tool = modifyTriggerTool(mockWorkflow);

      const result = await tool.execute({
        cron: 'invalid-cron',
      });

      expect(result).toEqual({ error });
    });
  });

  describe('swapNodesTool', () => {
    it('should swap nodes successfully', async () => {
      const tool = swapNodesTool(mockWorkflow);

      const result = await tool.execute({
        identifier1: 'node-1',
        identifier2: 'node-2',
      });

      expect(mockWorkflow.swapNodes).toHaveBeenCalledWith('node-1', 'node-2');
      expect(result).toBe('Swapped nodes node-1 and node-2');
    });

    it('should handle swap errors', async () => {
      const error = new Error('Swap failed');
      mockWorkflow.swapNodes.mockImplementation(() => {
        throw error;
      });

      const tool = swapNodesTool(mockWorkflow);

      const result = await tool.execute({
        identifier1: 'node-1',
        identifier2: 'node-2',
      });

      expect(result).toEqual({ error });
    });
  });

  describe('addInputTool', () => {
    it('should add input node successfully', async () => {
      const tool = addInputTool(mockWorkflow);
      const outputData = JSON.stringify({ key: 'value' });

      const result = await tool.execute({
        toolIdentifier: 'parent-id',
        output: outputData,
      });

      expect(mockWorkflow.addAfter).toHaveBeenCalledWith(
        'parent-id',
        expect.objectContaining({
          identifier: 'test-uuid-123',
          type: 'fixed-input',
          output: { key: 'value' },
          child: null,
        }),
      );
      expect(result).toBe(
        'Added fixed input node with identifier test-uuid-123',
      );
    });

    it('should add input node at root when identifier is empty', async () => {
      const tool = addInputTool(mockWorkflow);

      await tool.execute({
        toolIdentifier: '   ',
        output: '{}',
      });

      expect(mockWorkflow.addAfter).toHaveBeenCalledWith(
        undefined,
        expect.any(Object),
      );
    });

    it('should handle JSON parsing errors', async () => {
      const tool = addInputTool(mockWorkflow);

      const result = await tool.execute({
        toolIdentifier: 'parent-id',
        output: 'invalid json',
      });

      expect(result).toHaveProperty('error');
    });
  });

  describe('addUpsertStateNodeTool', () => {
    it('should add upsert state node successfully', async () => {
      const tool = addUpsertStateNodeTool(mockWorkflow);

      const result = await tool.execute({
        parentIdentifier: 'parent-id',
        key: 'state-key',
        value: 'state-value',
      });

      expect(mockWorkflow.addAfter).toHaveBeenCalledWith(
        'parent-id',
        expect.objectContaining({
          identifier: 'test-uuid-123',
          type: 'upsert-state',
          key: 'state-key',
          value: 'state-value',
          child: null,
        }),
      );
      expect(result).toBe(
        'Added upsert state node with key "state-key" and identifier test-uuid-123',
      );
    });

    it('should add at root when parentIdentifier is null', async () => {
      const tool = addUpsertStateNodeTool(mockWorkflow);

      await tool.execute({
        parentIdentifier: null,
        key: 'key',
        value: 'value',
      });

      expect(mockWorkflow.addAfter).toHaveBeenCalledWith(
        undefined,
        expect.any(Object),
      );
    });
  });

  describe('addSkipNodeTool', () => {
    it('should add skip node successfully', async () => {
      const tool = addSkipNodeTool(mockWorkflow);

      const result = await tool.execute({
        parentIdentifier: 'parent-id',
      });

      expect(mockWorkflow.addAfter).toHaveBeenCalledWith(
        'parent-id',
        expect.objectContaining({
          identifier: 'test-uuid-123',
          type: 'skip',
          child: null,
        }),
      );
      expect(result).toBe('Added skip node with identifier test-uuid-123');
    });
  });

  describe('addTodoListItemsTool', () => {
    it('should add items to todo list successfully', async () => {
      const tool = addTodoListItemsTool(mockTodoList);
      const items = [
        { title: 'Task 1', completed: false },
        { title: 'Task 2', completed: true },
      ];

      const result = await tool.execute({ items });

      expect(mockTodoList.addItems).toHaveBeenCalledWith(items);
      expect(result).toEqual({
        todoList: 'Mock todo list',
        message: 'Added 2 items to todo list',
      });
    });
  });

  describe('markAsComplete', () => {
    it('should mark items as completed successfully', async () => {
      const tool = markAsComplete(mockTodoList);
      const indices = [0, 2];

      const result = await tool.execute({
        markCompleted: indices,
      });

      expect(mockTodoList.markAsCompletedByIndex).toHaveBeenCalledTimes(2);
      expect(mockTodoList.markAsCompletedByIndex).toHaveBeenCalledWith(0);
      expect(mockTodoList.markAsCompletedByIndex).toHaveBeenCalledWith(2);
      expect(result).toEqual({
        todoList: 'Mock todo list',
        message: 'Updated todo list. Marked 2 as completed',
      });
    });

    it('should handle empty markCompleted array', async () => {
      const tool = markAsComplete(mockTodoList);

      const result = await tool.execute({
        markCompleted: [],
      });

      expect(mockTodoList.markAsCompletedByIndex).not.toHaveBeenCalled();
      expect(result).toEqual({
        todoList: 'Mock todo list',
        message: 'Updated todo list. Marked 0 as completed',
      });
    });

    it('should handle undefined markCompleted', async () => {
      const tool = markAsComplete(mockTodoList);

      const result = await tool.execute({});

      expect(mockTodoList.markAsCompletedByIndex).not.toHaveBeenCalled();
      expect(result).toEqual({
        todoList: 'Mock todo list',
        message: 'Updated todo list. Marked 0 as completed',
      });
    });
  });

  describe('createChildNode helper function', () => {
    it('should create tool node child', async () => {
      // This tests the createChildNode function indirectly through addBooleanTrueChildTool
      const mockBooleanNode = {
        type: 'boolean',
        trueChild: null,
        falseChild: null,
      };
      mockWorkflow.findNode.mockReturnValue(mockBooleanNode);

      const tool = addBooleanTrueChildTool(mockWorkflow);

      await tool.execute({
        booleanNodeId: 'boolean-node-id',
        childNode: {
          type: 'tool',
          toolIdentifier: 'test-tool',
        },
      });

      expect(mockBooleanNode.trueChild).toEqual(
        expect.objectContaining({
          type: 'tool',
          toolIdentifier: 'test-tool',
        }),
      );
    });

    it('should create converter node child', async () => {
      const mockBooleanNode = {
        type: 'boolean',
        trueChild: null,
        falseChild: null,
      };
      mockWorkflow.findNode.mockReturnValue(mockBooleanNode);

      const tool = addBooleanTrueChildTool(mockWorkflow);

      await tool.execute({
        booleanNodeId: 'boolean-node-id',
        childNode: {
          type: 'converter',
          code: 'test code',
        },
      });

      expect(mockBooleanNode.trueChild).toEqual(
        expect.objectContaining({
          type: 'converter',
          code: 'test code',
        }),
      );
    });

    it('should create fixed-input node child', async () => {
      const mockBooleanNode = {
        type: 'boolean',
        trueChild: null,
        falseChild: null,
      };
      mockWorkflow.findNode.mockReturnValue(mockBooleanNode);

      const tool = addBooleanTrueChildTool(mockWorkflow);

      await tool.execute({
        booleanNodeId: 'boolean-node-id',
        childNode: {
          type: 'fixed-input',
          output: '{"key": "value"}',
        },
      });

      expect(mockBooleanNode.trueChild).toEqual(
        expect.objectContaining({
          type: 'fixed-input',
          output: { key: 'value' },
        }),
      );
    });

    it('should create upsert-state node child', async () => {
      const mockBooleanNode = {
        type: 'boolean',
        trueChild: null,
        falseChild: null,
      };
      mockWorkflow.findNode.mockReturnValue(mockBooleanNode);

      const tool = addBooleanTrueChildTool(mockWorkflow);

      await tool.execute({
        booleanNodeId: 'boolean-node-id',
        childNode: {
          type: 'upsert-state',
          key: 'state-key',
          value: 'state-value',
        },
      });

      expect(mockBooleanNode.trueChild).toEqual(
        expect.objectContaining({
          type: 'upsert-state',
          key: 'state-key',
          value: 'state-value',
        }),
      );
    });

    it('should create skip node child', async () => {
      const mockBooleanNode = {
        type: 'boolean',
        trueChild: null,
        falseChild: null,
      };
      mockWorkflow.findNode.mockReturnValue(mockBooleanNode);

      const tool = addBooleanTrueChildTool(mockWorkflow);

      await tool.execute({
        booleanNodeId: 'boolean-node-id',
        childNode: {
          type: 'skip',
        },
      });

      expect(mockBooleanNode.trueChild).toEqual(
        expect.objectContaining({
          type: 'skip',
        }),
      );
    });

    it('should throw error for unsupported child node type', async () => {
      const mockBooleanNode = {
        type: 'boolean',
        trueChild: null,
        falseChild: null,
      };
      mockWorkflow.findNode.mockReturnValue(mockBooleanNode);

      const tool = addBooleanTrueChildTool(mockWorkflow);

      const result = await tool.execute({
        booleanNodeId: 'boolean-node-id',
        childNode: {
          type: 'unsupported-type' as any,
        },
      });

      expect(result).toHaveProperty('error');
    });

    it('should handle missing required fields for tool node', async () => {
      const mockBooleanNode = {
        type: 'boolean',
        trueChild: null,
        falseChild: null,
      };
      mockWorkflow.findNode.mockReturnValue(mockBooleanNode);

      const tool = addBooleanTrueChildTool(mockWorkflow);

      const result = await tool.execute({
        booleanNodeId: 'boolean-node-id',
        childNode: {
          type: 'tool',
          // Missing toolIdentifier
        },
      });

      expect(result).toHaveProperty('error');
    });
  });
});
