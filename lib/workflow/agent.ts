'server-only';

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject, generateText, tool } from 'ai';
import { v4 } from 'uuid';
import type { z } from 'zod';
import { createMCPClient } from '../ai/mcp';
import {
  WorkflowInputOutputMismatchError,
  WorkflowReferenceError,
  WorkflowToolMissingError,
} from './errors';
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
import { MAX_WORKFLOW_STEPS } from '../constants';
import type { UserContext } from '../types';
import { WorkflowEngine } from './workflow-engine';
import { createJSExecutionEngine, createToolExecutionEngine } from './engine';

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

const generalWorkflowPrompt = () => `

## WORKFLOW STRUCTURE
A workflow consists of:
- **Title**: Descriptive name for the workflow
- **Trigger**: Entry point (cronjob-trigger with cron schedule)
- **Nodes**: Connected execution units forming a directed graph

## AVAILABLE NODE TYPES

### 1. CronjobTriggerNode (Entry Point)
- **Type**: "cronjob-trigger"
- **Properties**: cron (e.g., "0 2 * * *"), identifier, child
- **Purpose**: Starts workflow execution on schedule
- **Connections**: Has one child, no parents

### 2. ToolNode (Execute MCP Tools)
- **Type**: "tool" 
- **Properties**: toolIdentifier, inputSchema, outputSchema, description, identifier, child
- **Purpose**: Executes MCP tools with specified inputs
- **Connections**: Has one parent, one child
- **Note**: Must match parent's output to this node's inputSchema

### 3. ConverterNode (Data Transformation)
- **Type**: "converter"
- **Properties**: runtime ("js"), code, identifier, child  
- **Purpose**: Transforms data between incompatible node schemas
- **Connections**: Has one parent, one child
- **Code Format**: JavaScript function that takes input and returns transformed output

### 4. ConditionNode (Conditional Logic)
- **Type**: "condition"
- **Properties**: runtime ("js"), code, identifier, children (array)
- **Purpose**: Conditional branching based on input data
- **Connections**: Has one parent, multiple children
- **Code Format**: JavaScript function returning child node identifier or null

### 5. FixedInput (Static Data Provider)
- **Type**: "fixed-input"
- **Properties**: identifier, output (object), child
- **Purpose**: Provides static or templated data to child nodes
- **Connections**: Has one parent, one child
- **Template Support**: Use Jinja2 syntax for dynamic values:
  - Use {{input.fieldName}} to access parent node output
  - Use {{context.fieldName}} to access global workflow context
- **Note** Fixed input should always be a parent of a tool node.


## WORKFLOW BUILDING RULES

### Schema Compatibility
1. **Always check tool schemas** using available schema tools before adding ToolNodes
2. **Parent-Child Matching**: Each node's input must match its parent's output schema
3. **Add ConverterNodes** when schemas don't match to transform data appropriately

### Node Connection Strategy
1. **Start with trigger**: Every workflow begins with a cronjob-trigger
2. **Linear flow**: Use regular nodes (tool, converter, fixed-input) for sequential execution
3. **Branching**: Use condition nodes when workflow needs conditional logic
4. **Data flow**: Ensure each node receives correctly formatted input from its parent

### Tool Integration
1. **Get tool schema first**: Use schema tools to understand input/output requirements
2. **Provide proper inputs**: Use FixedInput nodes when tools need specific parameters
3. **Handle mismatches**: Add ConverterNodes between incompatible schemas

### Cronjob Trigger
1. **Make sure the cron expression is valid** - Use standard cron format (e.g., "0 */10 * * *" for every 10 minutes)
2. **Make sure the cron expression matches the user query** - If user specifies timing (e.g., "every hour", "daily"), set appropriate cron expression
3. You can call the modifyTriggerTool tool to modify the cron expression

### Node Swapping
1. **Use swapNodesTool** to swap two nodes in the workflow
2. **Make sure the nodes are not the trigger node**
3. **Make sure the nodes are not the same node**
4. **Make sure the nodes have the same parent**
5. After swapping, their original children will not be swapped. For example: node1 -> child1 -> node2 -> child2, after swapping node1 and node2, the workflow will be node2 -> child1 -> node1 -> child2

## EXAMPLE WORKFLOWS

### Simple Tool Execution Pattern
1. User query: "Create a workflow to fetch BTCUSDT price"
- Start with cronjob-trigger (cron schedule)
- Add fixed-input node with tool parameters (through addInputTool tool not addNodeTool) that matches the child tool's input schema
- Add tool node after fixed-input node with proper toolIdentifier to fetch price
- Ensure schemas match between nodes

2. User query: "Create a workflow to fetch BTCUSDT price and send notification"
- Start with cronjob-trigger (cron schedule)
- Add fixed-input node with tool parameters (through addInputTool tool not addNodeTool) that matches the child tool's input schema
- Add tool node after fixed-input node with proper toolIdentifier to fetch price
- Add tool node after tool node with proper toolIdentifier to send notification
- Ensure schemas match between nodes

### Data Conversion Pattern  
- Tool node outputs data
- Converter node transforms the data format
- Next tool node receives transformed input
- Use "async function handle(input) { return transformed; }" pattern

### Conditional Branching Pattern
- Condition node evaluates input
- Returns child node identifier to execute next
- Multiple children possible for different paths
- Use "async function handle(input) { return childId; }" pattern

## INSTRUCTIONS
1. **Follow suggestions** if provided to modify the workflow appropriately
2. **Use viewWorkflow tool** to check existing workflow structure and node IDs
3. **Never generate node IDs manually** - always check existing workflow for proper IDs
4. **Build incrementally** - add nodes one at a time and verify schema compatibility
5. **Prioritize schema tools** to understand tool requirements before adding ToolNodes
6. **Use available workflow modification tools** (addNodeTool, addConverterTool, etc.)
7. **Condition node** Don't need to add this node without multiple parents.

Remember: Node identifiers in the workflow are different from tool identifiers. Always use viewWorkflow to find the correct node IDs for connections.
`;

const DiscoverySystemPrompt = `
    You are a tool discovery agent. 
    Your job is to analyze the user query and select the most relevant tools from the available MCP tools.
    
    You should return list of the tools' identifiers that you think are relevant to the user query.
    And the reasoning for the selected tools. Always returned list of tools, even if it is empty.
    Refine your search query to find the most relevant tools.
  `;

/**
 * Generates a prompt string containing user context information for workflow execution.
 * This context can be used in FixedInput nodes and as input parameters for tools.
 *
 * @param userContext - The user's context information containing relevant data for workflow execution
 * @returns A formatted string containing the user context, or empty string if no context is provided
 *
 * @example
 * // With context
 * const context = { userId: "123", preferences: { timezone: "UTC" } };
 * // Returns: "User Context: {"userId":"123","preferences":{"timezone":"UTC"}}.
 * // This context is available in the workflow and can be accessed in two ways:
 * // 1. In FixedInput nodes using Jinja2 syntax: {{context.userId}}
 * // 2. As direct input parameters to tools that accept user context"
 */
const userContextPrompt = (userContext: UserContext | null) => {
  if (!userContext) {
    return 'No user context provided';
  }
  return `User Context: ${JSON.stringify(userContext)}. 
This context is available in the workflow and can be accessed in two ways:
1. In FixedInput nodes using Jinja2 syntax: {{context.fieldName}}
2. As direct input parameters to tools that accept user context`;
};

const WorkflowBuilderSystemPrompt = (
  toolDiscoveryResult: z.infer<typeof DiscoverySchema>,
  userContext: UserContext | null,
  suggestion: z.infer<typeof SuggestionSchema> | null,
) => `
You are a workflow builder that creates structured workflows based on user queries and available MCP tools.

# USER CONTEXT
${userContextPrompt(userContext)}

${generalWorkflowPrompt()}

## CURRENT CONTEXT
- **Selected Tools**: ${JSON.stringify(toolDiscoveryResult.selectedTools)}
- **User Query**: ${toolDiscoveryResult.reasoning}
- **Suggestions**: ${JSON.stringify(suggestion)}

`;

const SuggestionSystemPrompt = async (
  workflow: Workflow,
  query: string,
  inputOutputMismatchError: WorkflowInputOutputMismatchError | null,
  missingToolsError: WorkflowToolMissingError | null,
  toolDiscoveryResult: z.infer<typeof DiscoverySchema> | null,
  userContext: UserContext | null,
) => {
  const generalPrompt = `
    You are a team leader that guides the workflow builder and suggestion agent.

    # USER CONTEXT
    ${userContextPrompt(userContext)}
    
    Your primary responsibilities:
    1. Evaluate the workflow builder's implementation
    2. Review suggestion agent recommendations
    3. Determine when the workflow is complete and should exit the building process

    # GENERAL WORKFLOW PROMPT
    ${generalWorkflowPrompt()}

    **If user ask about to send notification, check whether this workflow has a notification tool.**
    
    Important guidelines:
    - The trigger is automatically assigned by the system - no modifications needed
    - Only add condition nodes when multiple execution paths are required
    - Only add converter nodes when tools have schema incompatibilities
    - Focus on creating a workflow that delivers results directly to the user
    - Keep the workflow simple - no need for error handling or retry logic
    
    Make decisions based on whether the workflow accomplishes the user's request efficiently.

    A workflow should contain at least one tool node and one input node. A workflow only contains trigger is invalid.
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
    User Query: ${query}
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
