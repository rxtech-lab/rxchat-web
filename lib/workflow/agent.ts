import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject, generateText, tool } from 'ai';
import { v4 } from 'uuid';
import { z } from 'zod';
import { createMCPClient } from '../ai/mcp';
import {
  WorkflowInputOutputMismatchError,
  WorkflowToolMissingError,
} from './errors';
import {
  addConditionTool,
  addConverterTool,
  addNodeTool,
  compileTool,
  modifyToolNode,
  removeNodeTool,
  viewWorkflow,
  Workflow,
} from './workflow';

const modelProviders = () => {
  const openRouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  return {
    workflow: openRouter('openai/gpt-4.1'),
    discovery: openRouter('openai/gpt-4.1'),
    suggestion: openRouter('google/gemini-2.5-flash-preview-05-20'),
  };
};

const DiscoverySchema = z.object({
  selectedTools: z.array(z.string()).describe('The selected tools identifiers'),
  reasoning: z.string().describe('The reasoning for the selected tools'),
});

const SuggestionSchema = z.object({
  suggestions: z
    .array(z.string())
    .describe('The suggestions for the workflow')
    .optional(),
  modifications: z
    .array(z.string())
    .describe('The modifications for the workflow')
    .optional(),
  nextStep: z
    .enum(['continue', 'stop'])
    .describe('The next step for the workflow'),
});

const DiscoverySystemPrompt = `
    You are a tool discovery agent. 
    Your job is to analyze the user query and select the most relevant tools from the available MCP tools.
    
    You should return list of the tools' identifiers that you think are relevant to the user query.
    And the reasoning for the selected tools. Always returned list of tools, even if it is empty.
    Refine your search query to find the most relevant tools.
  `;

const WorkflowBuilderSystemPrompt = (
  toolDiscoveryResult: z.infer<typeof DiscoverySchema>,
  suggestion: z.infer<typeof SuggestionSchema> | null,
) => `
   You are a workflow builder that will generate a workflow (nested json)
   base on the user query and the selected tools. You need to use schema tool to get
   the input and output schema (json schema) of the tools.
   If you need more tools, you can return a request in the generated object to get more tools.
   Don't try to search for tools, your teammate will do that for you.
  
   Selected tools: ${JSON.stringify(toolDiscoveryResult.selectedTools)}
   User Query: ${toolDiscoveryResult.reasoning}
   Suggestion: ${JSON.stringify(suggestion)}

   If tool'input doesn't match its parent's output, 
   you need to add a converter node to convert the input to the parent's output.

   For example:

   Tool a:
   Input: {
    query: string
   }
   Output: {
    firstName: string
    lastName: string
   }

   Tool b:
   Input: {
    name: string
   }
   Output: {
    name: string
   }

   Then you need to add a converter node to convert the input to the parent's output.
   Converter node:
    ts:
    async function handle(input: any): Promise<any> {
      return input.firstName + ' ' + input.lastName;
    }


   If you got suggestion, you need to follow the suggestion to build the workflow.
   When calling schema tool, you should provide the input identifier to search for the tool.
   When adding new node, use viewWorkflow tool to check the existing schema and its ids,
   and this id is different from the tool's identifier. This id is used to connect the nodes.
   Don't generate this id, look up the workflow and find the id in the workflow tree!
  `;

const SuggestionSystemPrompt = async (
  workflow: Workflow,
  inputOutputMismatchError: WorkflowInputOutputMismatchError | null,
  missingToolsError: WorkflowToolMissingError | null,
  toolDiscoveryResult: z.infer<typeof DiscoverySchema> | null,
) => {
  const generalPrompt = `
    You are a team leader that will guide the workflow builder and the suggestion agent.
    You are responsible to judge the workflow builder's work and the suggestion agent's work.
    You are also responsible to exit the workflow if you think the workflow is complete.
    You don't need to worry about the trigger, it is assigned by the system.
  `;

  if (inputOutputMismatchError) {
    return `
      ${generalPrompt}
      Workflow: ${JSON.stringify(workflow.getWorkflow())}
      Input node doesn't match output node: ${inputOutputMismatchError.errors.join(', ')}. 
      Compiler's Suggestions: ${inputOutputMismatchError.suggestions.join(', ')}.
      
      You should let the workflow builder to add a converter node between the input and output nodes.
    `;
  }

  if (missingToolsError) {
    return `
      ${generalPrompt}
      Workflow: ${JSON.stringify(workflow.getWorkflow())}
      Tools not exist: ${missingToolsError.getMissingTools().join(', ')}
      You should give suggestion modify the workflow to replace tools that not exist.
    `;
  }

  // Await the compile result before interpolating it into the template string
  let compilingResult: any;
  try {
    compilingResult = await workflow.compile();
  } catch (error) {
    compilingResult = {
      error:
        error instanceof Error ? error.message : 'Unknown compilation error',
    };
  }

  return `
    ${generalPrompt}
  
    Workflow: ${JSON.stringify(workflow.getWorkflow())}
    Compiling Result: ${JSON.stringify(compilingResult)}
    Tools: ${JSON.stringify(toolDiscoveryResult?.selectedTools)}
    User Query: ${toolDiscoveryResult?.reasoning}
  `;
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
    },
    toolChoice: 'required',
    system: WorkflowBuilderSystemPrompt(toolDiscoveryResult, suggestion),
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
  toolDiscoveryResult: z.infer<typeof DiscoverySchema> | null,
): Promise<z.infer<typeof SuggestionSchema>> {
  const model = modelProviders().suggestion;
  if (error !== null) {
    const suggestion = await generateObject({
      model,
      schema: SuggestionSchema,
      system: await SuggestionSystemPrompt(
        workflow,
        error instanceof WorkflowInputOutputMismatchError ? error : null,
        error instanceof WorkflowToolMissingError ? error : null,
        toolDiscoveryResult,
      ),
      prompt: `User Query: "${query}", Error: ${error.message}`,
    });
    return suggestion.object;
  }
  try {
    await workflow.compile();
  } catch (error) {
    if (error instanceof WorkflowInputOutputMismatchError) {
      const suggestion = await generateObject({
        model,
        schema: SuggestionSchema,
        system: await SuggestionSystemPrompt(
          workflow,
          error,
          null,
          toolDiscoveryResult,
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
          null,
          error,
          toolDiscoveryResult,
        ),
        prompt: `User got the workflow tool's missing error indicates that some tools in the workflow are not available in MCP. User Query: "${query}".`,
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
      null,
      null,
      toolDiscoveryResult,
    ),
    prompt: `User Query: "${query}"`,
  });
  return object.object;
}

export async function agent(query: string) {
  const mcpClient = await createMCPClient();
  let workflowResult: { workflow: Workflow; response: string } | null = {
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
  const maxSteps = 4;

  try {
    let step = 0;
    while (true) {
      try {
        if (step >= maxSteps) {
          break;
        }
        toolDiscovery = await toolDiscoveryAgent(query, suggestion, mcpClient);
        console.log('toolDiscovery', toolDiscovery);
        workflowResult = await workflowBuilderAgent(
          query,
          suggestion,
          mcpClient,
          toolDiscovery,
          workflowResult?.workflow,
        );
        console.dir(workflowResult, { depth: null });
        suggestion = await suggestionAgent(
          query,
          null,
          workflowResult.workflow,
          toolDiscovery,
        );
        console.log('suggestion', suggestion);
        if (suggestion.nextStep === 'stop') {
          break;
        }
      } catch (error) {
        console.log(error);
        suggestion = await suggestionAgent(
          query,
          error as Error,
          workflowResult?.workflow,
          toolDiscovery ?? null,
        );
        if (suggestion.nextStep === 'stop') {
          break;
        }
      } finally {
        step++;
      }
    }

    console.log('workflowResult', workflowResult);
    return workflowResult;
  } catch (error) {
    console.error('Error occurred during workflow generation:', error);
  } finally {
    if (mcpClient) {
      await mcpClient.close();
    }
  }
}
