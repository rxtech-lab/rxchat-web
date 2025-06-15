'server-only';

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, tool } from 'ai';
import { v4 } from 'uuid';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createMCPClient } from '../ai/mcp';
import { MAX_WORKFLOW_STEPS } from '../constants';
import { UserContextSchema, type UserContext } from '../types';
import { createJSExecutionEngine, createToolExecutionEngine } from './engine';
import {
  WorkflowInputOutputMismatchError,
  WorkflowToolMissingError,
} from './errors';
import {
  DiscoverySystemPrompt,
  SuggestionSystemPrompt,
  WorkflowBuilderSystemPrompt,
} from './prompts';
import {
  DiscoverySchema,
  SuggestionSchema,
  type OnStep,
  type WorkflowOptions,
} from './types';
import {
  addConditionTool,
  addConverterTool,
  addInputTool,
  addNodeTool,
  compileTool,
  modifyToolNode,
  modifyTriggerTool,
  removeNodeTool,
  swapNodesTool,
  viewWorkflow,
  Workflow,
} from './workflow';
import { WorkflowEngine } from './workflow-engine';

const modelProviders = () => {
  const openRouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  return {
    workflow: openRouter('google/gemini-2.5-pro-preview'),
    discovery: openRouter('google/gemini-2.5-pro-preview'),
    suggestion: openRouter('google/gemini-2.5-pro-preview'),
  };
};

/**
 * Parameters for the tool discovery agent
 */
interface ToolDiscoveryAgentParams {
  query: string;
  suggestion: z.infer<typeof SuggestionSchema> | null;
  mcpClient: any;
  workflow: Workflow;
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
          'Tools not exist, refine the tools to make sure they are available in the MCP Router.',
      });
      if (missingTools.length === 0) {
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
}: WorkflowBuilderAgentParams): Promise<{
  workflow: Workflow;
  response: string;
}> {
  const model = modelProviders().workflow;
  const availableTools = await mcpClient.tools();

  const { text } = await generateText({
    model,
    tools: {
      ...availableTools,
      addNodeTool: addNodeTool(workflow),
      addConditionTool: addConditionTool(workflow),
      removeNodeTool: removeNodeTool(workflow),
      getWorkflow: viewWorkflow(workflow),
      modifyNodeTool: modifyToolNode(workflow),
      compileTool: compileTool(workflow),
      addConverterTool: addConverterTool(workflow),
      addInputTool: addInputTool(workflow),
      modifyTriggerTool: modifyTriggerTool(workflow),
      swapNodesTool: swapNodesTool(workflow),
    },
    toolChoice: 'required',
    system: WorkflowBuilderSystemPrompt(
      toolDiscoveryResult,
      userContext,
      suggestion,
    ),
    prompt: `User Query: "${query}"`,
    maxSteps: 5,
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
  options = {},
}: SuggestionAgentParams): Promise<z.infer<typeof SuggestionSchema>> {
  const model = modelProviders().suggestion;
  let prompt = `User Query: "${query}"`;
  if (error !== null) {
    prompt = `User Query: "${query}", Error: ${error.message}`;
  }
  try {
    await workflow.compile();
  } catch (error) {
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
  }

  const result = await generateText({
    model,
    tools: {
      workflowExecutor: tool({
        description: `Execute the workflow. You can use this to execute the workflow and see the error message. 
          You can also use this to execute the workflow and see the result.
          User Context: ${JSON.stringify(zodToJsonSchema(UserContextSchema))}`,
        parameters: z.object({}),
        execute: async (args) => {
          try {
            const engine = new WorkflowEngine(
              options.jsExecutionEngine ?? createJSExecutionEngine(),
              options.toolExecutionEngine ?? createToolExecutionEngine(),
            );
            const result = await engine.execute(
              workflow.getWorkflow(),
              userContext ?? {},
            );
            return result;
          } catch (error: any) {
            return {
              error: error.message,
            };
          }
        },
      }),
      answerTool: tool({
        description: 'Provide suggestions for the workflow',
        parameters: SuggestionSchema,
      }),
    },
    toolChoice: 'required',
    system: await SuggestionSystemPrompt(
      workflow,
      query ?? '',
      null,
      null,
      toolDiscoveryResult,
      userContext,
    ),
    prompt: prompt,
    maxSteps: 10,
  });

  const lastToolCall = Array.from(result.toolCalls).pop();
  return SuggestionSchema.parse(lastToolCall?.args);
}

export async function agent(
  query: string,
  oldWorkflow: Workflow | null = null,
  userContext: UserContext | null = null,
  options: WorkflowOptions = {},
  onStep?: (step: OnStep) => void,
): Promise<OnStep> {
  const mcpClient = await createMCPClient();
  let workflowResult: { workflow: Workflow; response: string } | null =
    oldWorkflow
      ? {
          workflow: new Workflow('New Workflow', {
            identifier: v4(),
            type: 'cronjob-trigger',
            cron: '0 2 * * *',
            child: null,
          }),
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
      error: null,
    });
    while (true) {
      try {
        if (step >= MAX_WORKFLOW_STEPS) {
          break;
        }
        if (suggestion?.skipToolDiscovery) {
        } else {
          onStep?.({
            title: 'Start Tool Discovery',
            type: 'info',
            toolDiscovery,
            suggestion,
            workflow: workflowResult?.workflow.getWorkflow(),
            error: null,
          });
          toolDiscovery = await toolDiscoveryAgent({
            query,
            suggestion,
            mcpClient,
            workflow: workflowResult?.workflow,
            onUpdate: (response) => {
              onStep?.({
                title: 'Tool Discovery',
                type: 'info',
                toolDiscovery: response,
                suggestion,
                workflow: workflowResult?.workflow.getWorkflow(),
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
          error: null,
        });
        workflowResult = await workflowBuilderAgent({
          query,
          suggestion,
          mcpClient,
          toolDiscoveryResult: toolDiscovery as any,
          userContext,
          workflow: workflowResult?.workflow,
          options,
        });
        onStep?.({
          title: 'Starting suggestion agent',
          type: 'info',
          toolDiscovery,
          suggestion,
          workflow: workflowResult?.workflow.getWorkflow(),
          error: null,
        });
        suggestion = await suggestionAgent({
          query,
          error: null,
          workflow: workflowResult.workflow,
          userContext,
          toolDiscoveryResult: toolDiscovery,
          options,
        });
        onStep?.({
          title: 'Deciding next step',
          type: 'info',
          toolDiscovery,
          suggestion,
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
          error: error as Error,
        });
        suggestion = await suggestionAgent({
          query,
          error: error as Error,
          workflow: workflowResult?.workflow,
          userContext,
          toolDiscoveryResult: toolDiscovery ?? null,
          options,
        });
        onStep?.({
          title: 'Suggestion',
          type: 'info',
          toolDiscovery,
          suggestion,
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
  };
}
