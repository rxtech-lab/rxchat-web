'server-only';

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject, generateText, tool } from 'ai';
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
import { DiscoverySystemPrompt, SuggestionSystemPrompt, WorkflowBuilderSystemPrompt } from './prompts';
import { DiscoverySchema, type OnStep, SuggestionSchema } from './types';
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
 * Agent 1: Tool Discovery Agent
 * Searches for available MCP tools based on the user query
 */
async function toolDiscoveryAgent(
  query: string,
  suggestion: z.infer<typeof SuggestionSchema> | null,
  mcpClient: any,
): Promise<{ selectedTools: any[]; reasoning: string }> {
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
      prompt: `User Query: "${query}", Suggestion: ${JSON.stringify(suggestion)}`,
      maxSteps: 10,
    });

    const lastToolCall = Array.from(result.toolCalls).pop();
    const parsedToolCall = DiscoverySchema.parse(lastToolCall?.args);
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
 * Agent 2: Workflow Builder Agent
 * Uses the selected tools to create and update the workflow
 */
async function workflowBuilderAgent(
  query: string,
  suggestion: z.infer<typeof SuggestionSchema> | null,
  mcpClient: any,
  toolDiscoveryResult: z.infer<typeof DiscoverySchema>,
  userContext: UserContext | null,
  workflow: Workflow,
): Promise<{ workflow: Workflow; response: string }> {
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
 * Agent 3: Suggestion Agent
 * Provides suggestions and modifications for the workflow
 */
async function suggestionAgent(
  query: string | undefined,
  error: Error | null,
  workflow: Workflow,
  userContext: UserContext | null,
  toolDiscoveryResult: z.infer<typeof DiscoverySchema> | null,
): Promise<z.infer<typeof SuggestionSchema>> {
  const model = modelProviders().suggestion;
  if (error !== null) {
    const suggestion = await generateObject({
      model,
      schema: SuggestionSchema,
      system: await SuggestionSystemPrompt(
        workflow,
        query ?? '',
        error instanceof WorkflowInputOutputMismatchError ? error : null,
        error instanceof WorkflowToolMissingError ? error : null,
        toolDiscoveryResult,
        userContext,
      ),
      prompt: `User Query: "${query}", Error: ${error.message}`,
    });
    return suggestion.object;
  }
  try {
    await workflow.compile();
    const engine = new WorkflowEngine(
      createJSExecutionEngine(),
      createToolExecutionEngine(),
    );
    await engine.execute(workflow.getWorkflow());
  } catch (error) {
    if (error instanceof WorkflowInputOutputMismatchError) {
      const suggestion = await generateObject({
        model,
        schema: SuggestionSchema,
        system: await SuggestionSystemPrompt(
          workflow,
          query ?? '',
          error,
          null,
          toolDiscoveryResult,
          userContext,
        ),
        prompt: `User got the workflow input/output mismatch error. That means you need to modify the workflow to match the input and output of the tools. User Query: "${query}".`,
      });
      return suggestion.object;
    }

    if (error instanceof WorkflowToolMissingError) {
      const suggestion = await generateObject({
        model,
        schema: SuggestionSchema,
        system: await SuggestionSystemPrompt(
          workflow,
          query ?? '',
          null,
          error,
          toolDiscoveryResult,
          userContext,
        ),
        prompt: `User got the workflow tool's missing error indicates that some tools in the workflow are not available in MCP. User Query: "${query}".`,
      });
      return suggestion.object;
    }

    if (error instanceof WorkflowReferenceError) {
      const suggestion = await generateObject({
        model,
        schema: SuggestionSchema,
        system: await SuggestionSystemPrompt(
          workflow,
          query ?? '',
          null,
          null,
          toolDiscoveryResult,
          userContext,
        ),
        prompt: `User got the workflow reference error. That means in the fixed input node, the output's jinja2 template is referencing a field that doesn't exist. User Query: "${query}". You need to check the node's parent and user context to find the correct field.`,
      });
      return suggestion.object;
    }

    console.error('Error during workflow compilation:', error);
  }

  const object = await generateObject({
    model,
    schema: SuggestionSchema,
    system: await SuggestionSystemPrompt(
      workflow,
      query ?? '',
      null,
      null,
      toolDiscoveryResult,
      userContext,
    ),
    prompt: `User Query: "${query}"`,
  });
  return object.object;
}

export async function agent(
  query: string,
  oldWorkflow: Workflow | null = null,
  userContext: UserContext | null = null,
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
          toolDiscovery = await toolDiscoveryAgent(
            query,
            suggestion,
            mcpClient,
          );
        }
        onStep?.({
          title: 'Starting Workflow Builder',
          type: 'info',
          toolDiscovery,
          suggestion,
          workflow: workflowResult?.workflow.getWorkflow(),
          error: null,
        });
        workflowResult = await workflowBuilderAgent(
          query,
          suggestion,
          mcpClient,
          toolDiscovery as any,
          userContext,
          workflowResult?.workflow,
        );
        onStep?.({
          title: 'Starting suggestion agent',
          type: 'info',
          toolDiscovery,
          suggestion,
          workflow: workflowResult?.workflow.getWorkflow(),
          error: null,
        });
        suggestion = await suggestionAgent(
          query,
          null,
          workflowResult.workflow,
          userContext,
          toolDiscovery,
        );
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
        suggestion = await suggestionAgent(
          query,
          error as Error,
          workflowResult?.workflow,
          userContext,
          toolDiscovery ?? null,
        );
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
