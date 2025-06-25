'server-only';

import { generateText, tool } from 'ai';
import { v4 } from 'uuid';
import type { z } from 'zod';
import { createMCPClient } from '../ai/mcp';
import { MAX_WORKFLOW_STEPS } from '../constants';
import type { UserContext } from '../types';
import { createJSExecutionEngine, createToolExecutionEngine } from './engine';
import {
  WorkflowInputOutputMismatchError,
  WorkflowReferenceError,
  WorkflowToolMissingError,
} from './errors';
import { modelProviders } from './models';
import {
  DiscoverySystemPrompt,
  SuggestionSystemPrompt,
  TodoListAgentSystemPrompt,
  WorkflowBuilderSystemPrompt,
} from './prompts';
import {
  DiscoverySchema,
  SuggestionSchema,
  TodoListAgentResponseSchema,
  type OnStep,
  type WorkflowOptions,
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

import { createTestStateClient } from './state/test';
import { TodoList } from './todolist/todolist';
import { Workflow } from './workflow';
import { WorkflowEngine } from './workflow-engine';

/**
 * Parameters for the tool discovery agent
 */
interface ToolDiscoveryAgentParams {
  query: string;
  suggestion: z.infer<typeof SuggestionSchema> | null;
  mcpClient: any;
  workflow: Workflow;
  todoList: TodoList;
  onUpdate: (response: z.infer<typeof DiscoverySchema>) => void;
}

/**
 * Agent 1: Tool Discovery Agent
 * Searches for available MCP tools based on the user query
 */
async function toolDiscoveryAgent({
  query,
  suggestion,
  mcpClient,
  workflow,
  todoList,
  onUpdate,
}: ToolDiscoveryAgentParams): Promise<{
  selectedTools: any[];
  reasoning: string;
}> {
  try {
    if (!mcpClient) {
      return {
        selectedTools: [],
        reasoning: 'MCP client not available',
      };
    }

    // Get all available tools from MCP client
    const availableTools = await mcpClient.tools();
    const model = modelProviders().discovery;
    let parsedToolCall: z.infer<typeof DiscoverySchema> | null = null;
    let missingTools: string[] = [];

    let retryCount = 0;
    while (true) {
      const result = await generateText({
        model,
        tools: {
          ...availableTools,
          answerTool: tool({
            description: 'Answer the user query',
            parameters: DiscoverySchema,
          }),
        },
        toolChoice: 'required',
        system: DiscoverySystemPrompt,
        prompt: `User Query: "${query}", Suggestion: ${JSON.stringify(suggestion)}.
        Missing Tools: ${missingTools.join(', ')}. If missing tools are provided, refine the tools to make sure they are available in the MCP Router.`,
        maxSteps: 5,
      });

      const lastToolCall = Array.from(result.toolCalls).pop();
      parsedToolCall = DiscoverySchema.parse(lastToolCall?.args);
      onUpdate(parsedToolCall);

      const { missingTools: newMissingTools } =
        await workflow.mcpRouter.checkToolsExist(parsedToolCall.selectedTools);
      missingTools = newMissingTools;
      onUpdate({
        ...parsedToolCall,
        reasoning:
          'Tools not exist, refine the tools to make sure they are available in the MCP Router. Use query tool to search for the tools first!',
      });
      if (missingTools.length === 0) {
        break;
      }
      retryCount++;
      if (retryCount > 5) {
        break;
      }
    }

    return parsedToolCall;
  } catch (error) {
    console.error('Tool Discovery Agent Error:', error);
    return {
      selectedTools: [],
      reasoning: 'Error occurred during tool discovery',
    };
  }
}

/**
 * Parameters for the workflow builder agent
 */
interface WorkflowBuilderAgentParams {
  query: string;
  suggestion: z.infer<typeof SuggestionSchema> | null;
  mcpClient: any;
  toolDiscoveryResult: z.infer<typeof DiscoverySchema>;
  userContext: UserContext | null;
  workflow: Workflow;
  options: WorkflowOptions;
  todoList: TodoList;
  onUpdate: (workflow: Workflow) => void;
}

/**
 * Agent 2: Workflow Builder Agent
 * Uses the selected tools to create and update the workflow
 */
async function workflowBuilderAgent({
  query,
  suggestion,
  mcpClient,
  toolDiscoveryResult,
  userContext,
  workflow,
  options,
  todoList,
  onUpdate,
}: WorkflowBuilderAgentParams): Promise<{
  workflow: Workflow;
  response: string;
}> {
  const model = modelProviders().workflow;
  const availableTools = await mcpClient.tools();
  const prompt = WorkflowBuilderSystemPrompt(
    toolDiscoveryResult,
    userContext,
    suggestion,
    todoList,
    workflow,
  );

  const { text } = await generateText({
    model,
    tools: {
      ...availableTools,
      addToolNodeTool: addToolNodeTool(workflow),
      addConditionTool: addConditionTool(workflow),
      removeNodeTool: removeNodeTool(workflow),
      getWorkflow: viewWorkflow(workflow),
      modifyNodeTool: modifyToolNode(workflow),
      compileTool: compileTool(workflow),
      addConverterTool: addConverterTool(workflow),
      addInputTool: addInputTool(workflow),
      modifyTriggerTool: modifyTriggerTool(workflow),
      swapNodesTool: swapNodesTool(workflow),
      addUpsertStateTool: addUpsertStateNodeTool(workflow),
      addSkipTool: addSkipNodeTool(workflow),
      addBooleanTool: addBooleanNodeTool(workflow),
      addBooleanTrueChildTool: addBooleanTrueChildTool(workflow),
      addBooleanFalseChildTool: addBooleanFalseChildTool(workflow),
    },
    system: prompt,
    prompt: `User Query: "${query}"`,
    maxSteps: 20,
    onStepFinish: (result) => {
      console.log(
        `(${result.toolCalls
          .map((toolCall) => toolCall.toolName)
          .join(', ')
          .substring(0, 100)})`,
      );
      onUpdate(workflow);
    },
  });

  return { workflow, response: text };
}

/**
 * Parameters for the suggestion agent
 */
interface SuggestionAgentParams {
  query: string | undefined;
  error: Error | null;
  workflow: Workflow;
  userContext: UserContext | null;
  toolDiscoveryResult: z.infer<typeof DiscoverySchema> | null;
  todoList: TodoList;
  options?: WorkflowOptions;
}

/**
 * Agent 3: Suggestion Agent
 * Provides suggestions and modifications for the workflow
 */
async function suggestionAgent({
  query,
  error,
  workflow,
  userContext,
  toolDiscoveryResult,
  todoList,
  options = {},
}: SuggestionAgentParams): Promise<z.infer<typeof SuggestionSchema>> {
  const model = modelProviders().suggestion;
  let prompt = `User Query: "${query}"`;
  if (error !== null) {
    prompt = `User Query: "${query}", Error: ${error.message}`;
  }
  try {
    await workflow.compile();
    const engine = new WorkflowEngine(
      options.jsExecutionEngine ?? createJSExecutionEngine(),
      options.toolExecutionEngine ?? createToolExecutionEngine(),
      createTestStateClient('e2e'),
    );
    await engine.execute(workflow.getWorkflow(), userContext ?? {});
  } catch (error: any) {
    if (error instanceof WorkflowInputOutputMismatchError) {
      prompt = `User got the workflow input/output mismatch error. That means you need to modify the workflow to match the input and output of the tools. User Query: "${query}".`;
    }

    if (error instanceof WorkflowToolMissingError) {
      return {
        modifications: [
          `Tools ${error.getMissingTools().join(', ')} doesn't exist in the MCP Router. Please make sure the tools are available using query tool.`,
        ],
        skipToolDiscovery: false,
      };
    }

    if (error instanceof WorkflowReferenceError) {
    } else {
      prompt = `Workflow execution failed. Please fix the error: ${error.message.substring(0, 1000)}`;
    }
  }

  const systemPrompt = await SuggestionSystemPrompt(
    workflow,
    query ?? '',
    null,
    null,
    toolDiscoveryResult,
    userContext,
  );

  const result = await generateText({
    model,
    tools: {
      answerTool: tool({
        description: 'Provide suggestions for the workflow',
        parameters: SuggestionSchema,
      }),
    },
    toolChoice: 'required',
    system: systemPrompt,
    prompt: prompt,
    maxSteps: 4,
  });

  const lastToolCall = Array.from(result.toolCalls).pop();
  return SuggestionSchema.parse(lastToolCall?.args);
}

/**
 * Parameters for the todo list agent
 */
interface TodoListAgentParams {
  query: string;
  userContext: UserContext | null;
  todoList: TodoList;
  mcpClient: any;
  workflow: Workflow;
}

/**
 * Agent 4: Todo List Agent
 * Manages todo lists based on user input, verifies task completion, and provides task status updates
 */
async function todoListAgent({
  query,
  userContext,
  mcpClient,
  todoList,
  workflow,
}: TodoListAgentParams): Promise<z.infer<typeof TodoListAgentResponseSchema>> {
  const model = modelProviders().todoList;

  const result = await generateText({
    model,
    tools: {
      addTodoListItems: addTodoListItemsTool(todoList),
      markAsComplete: markAsComplete(todoList),
      answerTool: tool({
        description: 'Provide todo list response',
        parameters: TodoListAgentResponseSchema,
      }),
    },
    toolChoice: 'required',
    system: TodoListAgentSystemPrompt({
      todoList,
      workflow,
    }),
    prompt: `User Query: "${query}"`,
    maxSteps: 10,
  });

  const lastToolCall = Array.from(result.toolCalls).pop();
  return TodoListAgentResponseSchema.parse(lastToolCall?.args);
}

export async function agent(
  query: string,
  oldWorkflow: Workflow | null = null,
  userContext: UserContext | null = null,
  options: WorkflowOptions = {},
  onStep?: (step: OnStep) => void,
): Promise<OnStep> {
  const mcpClient = await createMCPClient();
  let workflowResult: {
    workflow: Workflow;
    response: string;
  } | null = oldWorkflow
    ? {
        workflow: Workflow.readFrom(oldWorkflow as any),
        response: '',
      }
    : {
        workflow: new Workflow('New Workflow', {
          identifier: v4(),
          type: 'cronjob-trigger',
          cron: '0 2 * * *',
          child: null,
        }),
        response: '',
      };
  let toolDiscovery: z.infer<typeof DiscoverySchema> | null = null;
  let suggestion: z.infer<typeof SuggestionSchema> | null = null;
  const todoList: TodoList = new TodoList();

  let status: 'success' | 'error' | 'continue' = 'success';
  let error: Error | null = null;

  try {
    let step = 0;
    onStep?.({
      title: 'Start',
      type: 'info',
      toolDiscovery,
      suggestion,
      workflow: workflowResult?.workflow.getWorkflow(),
      todoList: todoList.toViewableObject(),
      error: null,
    });
    while (true) {
      try {
        if (step >= MAX_WORKFLOW_STEPS) {
          break;
        }

        onStep?.({
          title: 'Start Todo List Agent',
          type: 'info',
          toolDiscovery,
          suggestion,
          workflow: workflowResult?.workflow.getWorkflow(),
          todoList: todoList.toViewableObject(),
          error: null,
        });

        await todoListAgent({
          query,
          userContext,
          mcpClient,
          todoList,
          workflow: workflowResult?.workflow,
        });

        if (suggestion?.skipToolDiscovery) {
        } else {
          onStep?.({
            title: 'Start Tool Discovery',
            type: 'info',
            toolDiscovery,
            suggestion,
            workflow: workflowResult?.workflow.getWorkflow(),
            todoList: todoList.toViewableObject(),
            error: null,
          });
          toolDiscovery = await toolDiscoveryAgent({
            query,
            suggestion,
            mcpClient,
            workflow: workflowResult?.workflow,
            todoList,
            onUpdate: (response) => {
              onStep?.({
                title: 'Tool Discovery',
                type: 'info',
                toolDiscovery: response,
                suggestion,
                workflow: workflowResult?.workflow.getWorkflow(),
                todoList: todoList.toViewableObject(),
                error: null,
              });
            },
          });
        }

        onStep?.({
          title: 'Starting Workflow Builder',
          type: 'info',
          toolDiscovery,
          suggestion,
          workflow: workflowResult?.workflow.getWorkflow(),
          todoList: todoList.toViewableObject(),
          error: null,
        });

        workflowResult = await workflowBuilderAgent({
          query,
          suggestion,
          mcpClient,
          toolDiscoveryResult: toolDiscovery as any,
          userContext,
          workflow: workflowResult?.workflow,
          todoList,
          options,
          onUpdate: (workflow) => {
            onStep?.({
              title: 'Starting Workflow Builder',
              type: 'info',
              toolDiscovery,
              suggestion,
              workflow: workflow.getWorkflow(),
              todoList: todoList.toViewableObject(),
              error: null,
            });
          },
        });

        onStep?.({
          title: 'Starting suggestion agent',
          type: 'info',
          toolDiscovery,
          suggestion,
          workflow: workflowResult?.workflow.getWorkflow(),
          todoList: todoList.toViewableObject(),
          error: null,
        });
        suggestion = await suggestionAgent({
          query,
          error: null,
          workflow: workflowResult.workflow,
          userContext,
          toolDiscoveryResult: toolDiscovery,
          todoList,
          options,
        });
        onStep?.({
          title: 'Deciding next step',
          type: 'info',
          toolDiscovery,
          suggestion,
          todoList: todoList.toViewableObject(),
          error: null,
          workflow: workflowResult?.workflow.getWorkflow(),
        });
        if ((suggestion.modifications ?? []).length === 0) {
          break;
        }
      } catch (error) {
        onStep?.({
          title: 'Error',
          type: 'error',
          toolDiscovery,
          suggestion,
          workflow: workflowResult?.workflow.getWorkflow(),
          todoList: todoList.toViewableObject(),
          error: error as Error,
        });
        suggestion = await suggestionAgent({
          query,
          error: error as Error,
          workflow: workflowResult?.workflow,
          userContext,
          toolDiscoveryResult: toolDiscovery ?? null,
          todoList,
          options,
        });
        onStep?.({
          title: 'Suggestion',
          type: 'info',
          toolDiscovery,
          suggestion,
          todoList: todoList.toViewableObject(),
          error: error as Error,
          workflow: workflowResult?.workflow.getWorkflow(),
        });
        if ((suggestion.modifications ?? []).length === 0) {
          break;
        }
      } finally {
        step++;
      }
    }
    return {
      workflow: workflowResult?.workflow.getWorkflow(),
      suggestion,
      toolDiscovery,
      todoList: todoList.toViewableObject(),
      error: null,
      type: 'success',
      title: 'Success',
    };
  } catch (err) {
    console.error('Error occurred during workflow generation:', err);
    status = 'error';
    error = err as Error;
  } finally {
    if (mcpClient) {
      await mcpClient.close();
    }
  }

  return {
    workflow: workflowResult?.workflow.getWorkflow(),
    suggestion,
    toolDiscovery,
    error: error,
    type: status,
    title: status,
    todoList: todoList.toViewableObject(),
  };
}
