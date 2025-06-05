import { smoothStream, streamText, generateObject, generateText } from 'ai';
import { getModelProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { updateDocumentPrompt } from '@/lib/ai/prompts';
import type { ProviderType } from '@/lib/ai/models';
import { createMCPClient } from '@/lib/ai/mcp';
import { z } from 'zod';

/**
 * Multi-Agent Workflow System for Flowchart Generation
 *
 * This system uses three sequential agents:
 * 1. Tool Discovery Agent - Searches for available tools based on user query
 * 2. Workflow Builder Agent - Uses tools and updates workflow
 * 3. Suggestion Agent - Provides suggestions and modifications
 */

// Zod schemas for structured generation
const ToolDiscoverySchema = z.object({
  selectedTools: z.array(z.string()),
  reasoning: z.string(),
});

const NodeSchema = z.object({
  id: z.string(),
  type: z.enum(['tool', 'input', 'output', 'conversion']),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.object({
    label: z.string(),
    description: z.string(),
    toolName: z.string().optional(),
  }),
});

const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

const WorkflowSchema = z.object({
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  reasoning: z.string(),
});

const SuggestionSchema = z.object({
  suggestions: z.array(z.string()),
  modifications: z.array(
    z.object({
      type: z.enum([
        'add_node',
        'remove_node',
        'modify_node',
        'add_edge',
        'remove_edge',
      ]),
      description: z.string(),
      details: z.record(z.any()),
    }),
  ),
  nextSteps: z.array(z.string()),
  questions: z.array(z.string()).optional(),
});

/**
 * Agent 1: Tool Discovery Agent
 * Searches for available MCP tools based on the user query
 */
async function toolDiscoveryAgent(
  query: string,
  mcpClient: any,
  model: any,
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
    const availableToolNames = Object.keys(availableTools);

    const response = await generateText({
      model,
      system: `You are a tool discovery agent. Your job is to analyze the user query and select the most relevant tools from the available MCP tools.
      
Available tools: ${availableToolNames.join(', ')}

For each query, you should:
1. Understand what the user wants to accomplish
2. Identify which tools would be needed to solve their problem
3. Consider the logical sequence of tool usage
4. Select only the most relevant tools (3-7 tools maximum)

Return a valid JSON object with:
{
  "selectedTools": ["tool1", "tool2", ...],
  "reasoning": "Your reasoning here"
}`,
      prompt: `User Query: "${query}"
      
Please analyze this query and select the most relevant tools that would be needed to solve this problem. Return only valid JSON.`,
      maxSteps: 5,
    });

    let selectedToolNames: string[] = [];
    let reasoning = 'Tool discovery completed';

    try {
      const parsed = JSON.parse(response.text);
      selectedToolNames = parsed.selectedTools || [];
      reasoning = parsed.reasoning || 'Tool discovery completed';
    } catch (e) {
      // Fallback: extract tool names from text
      selectedToolNames = availableToolNames.filter((tool) =>
        response.text.toLowerCase().includes(tool.toLowerCase()),
      );
      reasoning = 'Fallback tool extraction from text';
    }

    // Get the actual tool objects
    const selectedToolObjects = selectedToolNames
      .filter((toolName: string) => availableTools[toolName])
      .map((toolName: string) => ({
        name: toolName,
        tool: availableTools[toolName],
      }));

    return {
      selectedTools: selectedToolObjects,
      reasoning,
    };
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
  selectedTools: any[],
  model: any,
  mcpClient: any,
): Promise<{ workflow: any; toolSchemas: any[]; reasoning: string }> {
  try {
    // Get schemas for selected tools
    const toolSchemas = [];
    for (const selectedTool of selectedTools) {
      try {
        // Get tool schema from MCP client
        const schema = (await mcpClient.getToolSchema?.(selectedTool.name)) || {
          input: { type: 'object', properties: {} },
          output: { type: 'object', properties: {} },
        };
        toolSchemas.push({
          name: selectedTool.name,
          inputSchema: schema.input,
          outputSchema: schema.output,
        });
      } catch (e) {
        // Fallback schema if tool schema is not available
        toolSchemas.push({
          name: selectedTool.name,
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
        });
      }
    }

    const response = await generateText({
      model,
      system: `You are a workflow builder agent. Your job is to create a workflow using the selected tools to solve the user's problem.

Available tools and their schemas:
${toolSchemas
  .map(
    (tool) => `
Tool: ${tool.name}
Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}
Output Schema: ${JSON.stringify(tool.outputSchema, null, 2)}
`,
  )
  .join('\n')}

Create a workflow that:
1. Uses the tools in a logical sequence
2. Handles data flow between tools
3. Includes conversion layers when output/input schemas don't match
4. Provides a clear solution to the user's problem

Return a JSON workflow with this structure:
{
  "nodes": [
    {
      "id": "unique_id",
      "type": "tool" | "input" | "output" | "conversion",
      "position": { "x": number, "y": number },
      "data": {
        "label": "Node Label",
        "toolName": "tool_name" (for tool nodes),
        "description": "What this node does"
      }
    }
  ],
  "edges": [
    {
      "id": "unique_edge_id", 
      "source": "source_node_id",
      "target": "target_node_id",
      "sourceHandle": "output_handle",
      "targetHandle": "input_handle"
    }
  ],
  "reasoning": "Explanation of the workflow design"
}`,
      prompt: `User Query: "${query}"

Create a workflow using the selected tools to solve this problem. Include conversion layers where needed.`,
      maxSteps: 10,
    });

    let workflow: any = {
      nodes: [],
      edges: [],
    };
    let reasoning = response.text;

    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        workflow = {
          nodes: parsed.nodes || [],
          edges: parsed.edges || [],
        };
        reasoning = parsed.reasoning || response.text;
      }
    } catch (e) {
      // Fallback: create a simple linear workflow
      workflow = createFallbackWorkflow(selectedTools, query);
      reasoning = 'Created fallback linear workflow due to parsing error';
    }

    return {
      workflow,
      toolSchemas,
      reasoning,
    };
  } catch (error) {
    console.error('Workflow Builder Agent Error:', error);
    return {
      workflow: { nodes: [], edges: [] },
      toolSchemas: [],
      reasoning: 'Error occurred during workflow building',
    };
  }
}

/**
 * Agent 3: Suggestion Agent
 * Provides suggestions and modifications for the workflow
 */
async function suggestionAgent(
  query: string,
  workflow: any,
  toolSchemas: any[],
  model: any,
): Promise<{
  suggestions: string[];
  modifications: any[];
  nextSteps: string[];
}> {
  try {
    const response = await generateText({
      model,
      system: `You are a suggestion agent. Your job is to analyze the created workflow and provide helpful suggestions, modifications, and next steps.

Review the workflow and provide:
1. Suggestions for improvement
2. Potential modifications
3. Next steps for the user
4. Questions that could lead to better workflows

Return JSON with:
{
  "suggestions": ["suggestion1", "suggestion2", ...],
  "modifications": [
    {
      "type": "add_node" | "remove_node" | "modify_node" | "add_edge" | "remove_edge",
      "description": "What to modify",
      "details": {}
    }
  ],
  "nextSteps": ["step1", "step2", ...],
  "questions": ["question1", "question2", ...]
}`,
      prompt: `User Query: "${query}"

Current Workflow:
${JSON.stringify(workflow, null, 2)}

Available Tool Schemas:
${JSON.stringify(toolSchemas, null, 2)}

Analyze this workflow and provide suggestions for improvement.`,
      maxSteps: 5,
    });

    let suggestions: string[] = [];
    let modifications: any[] = [];
    let nextSteps: string[] = [];

    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestions = parsed.suggestions || [];
        modifications = parsed.modifications || [];
        nextSteps = parsed.nextSteps || [];
      }
    } catch (e) {
      // Fallback suggestions
      suggestions = [
        'Consider adding error handling nodes',
        'Review data flow between tools',
        'Add validation steps',
      ];
      nextSteps = [
        'Test the workflow with sample data',
        'Refine tool parameters',
        'Add monitoring capabilities',
      ];
    }

    return {
      suggestions,
      modifications,
      nextSteps,
    };
  } catch (error) {
    console.error('Suggestion Agent Error:', error);
    return {
      suggestions: ['Error occurred during suggestion generation'],
      modifications: [],
      nextSteps: ['Please try again'],
    };
  }
}

/**
 * Creates a fallback linear workflow when JSON parsing fails
 */
function createFallbackWorkflow(selectedTools: any[], query: string) {
  const nodes = [
    {
      id: 'input',
      type: 'input',
      position: { x: 100, y: 100 },
      data: {
        label: 'User Input',
        description: query,
      },
    },
  ];

  const edges = [];
  let yPosition = 200;

  selectedTools.forEach((tool, index) => {
    const nodeId = `tool_${index}`;
    nodes.push({
      id: nodeId,
      type: 'tool',
      position: { x: 100, y: yPosition },
      data: {
        label: tool.name,
        toolName: tool.name,
        description: `Execute ${tool.name}`,
      } as any,
    });

    // Connect to previous node
    const sourceId = index === 0 ? 'input' : `tool_${index - 1}`;
    edges.push({
      id: `edge_${index}`,
      source: sourceId,
      target: nodeId,
      sourceHandle: 'output',
      targetHandle: 'input',
    });

    yPosition += 100;
  });

  // Add output node
  nodes.push({
    id: 'output',
    type: 'output',
    position: { x: 100, y: yPosition },
    data: {
      label: 'Result',
      description: 'Final workflow output',
    },
  });

  if (selectedTools.length > 0) {
    edges.push({
      id: 'final_edge',
      source: `tool_${selectedTools.length - 1}`,
      target: 'output',
      sourceHandle: 'output',
      targetHandle: 'input',
    });
  }

  return { nodes, edges };
}

/**
 * Main flowchart document handler
 */
export const flowchartDocumentHandler = (
  selectedChatModel: string,
  selectedChatModelProvider: ProviderType,
) =>
  createDocumentHandler<'flowchart'>({
    kind: 'flowchart',
    selectedChatModel,
    selectedChatModelProvider,
    onCreateDocument: async ({ title, dataStream }) => {
      let draftContent = '';
      const provider = getModelProvider(
        selectedChatModel,
        selectedChatModelProvider,
      );

      const model = provider.languageModel('artifact-model');

      // Initialize MCP client for tool discovery
      let mcpClient: any = null;
      try {
        mcpClient = await createMCPClient();
      } catch (error) {
        console.error('Failed to create MCP client:', error);
        // Continue without MCP tools
      }

      try {
        // Step 1: Tool Discovery Agent
        dataStream.writeData({
          type: 'flow-step',
          content: JSON.stringify({
            step: 1,
            agent: 'Tool Discovery Agent',
            status: 'running',
            message: 'Searching for relevant tools...',
          }),
        });

        const toolDiscovery = await toolDiscoveryAgent(title, mcpClient, model);

        dataStream.writeData({
          type: 'flow-step',
          content: JSON.stringify({
            step: 1,
            agent: 'Tool Discovery Agent',
            status: 'completed',
            result: toolDiscovery,
            message: `Found ${toolDiscovery.selectedTools.length} relevant tools`,
          }),
        });

        // Step 2: Workflow Builder Agent
        dataStream.writeData({
          type: 'flow-step',
          content: JSON.stringify({
            step: 2,
            agent: 'Workflow Builder Agent',
            status: 'running',
            message: 'Creating workflow...',
          }),
        });

        const workflowResult = await workflowBuilderAgent(
          title,
          toolDiscovery.selectedTools,
          model,
          mcpClient,
        );

        dataStream.writeData({
          type: 'flow-step',
          content: JSON.stringify({
            step: 2,
            agent: 'Workflow Builder Agent',
            status: 'completed',
            result: workflowResult,
            message: `Created workflow with ${workflowResult.workflow.nodes.length} nodes`,
          }),
        });

        // Step 3: Suggestion Agent
        dataStream.writeData({
          type: 'flow-step',
          content: JSON.stringify({
            step: 3,
            agent: 'Suggestion Agent',
            status: 'running',
            message: 'Generating suggestions...',
          }),
        });

        const suggestions = await suggestionAgent(
          title,
          workflowResult.workflow,
          workflowResult.toolSchemas,
          model,
        );

        dataStream.writeData({
          type: 'flow-step',
          content: JSON.stringify({
            step: 3,
            agent: 'Suggestion Agent',
            status: 'completed',
            result: suggestions,
            message: `Generated ${suggestions.suggestions.length} suggestions`,
          }),
        });

        // Combine all results into final workflow
        const finalWorkflow = {
          query: title,
          toolDiscovery,
          workflow: workflowResult.workflow,
          toolSchemas: workflowResult.toolSchemas,
          suggestions,
          metadata: {
            createdAt: new Date().toISOString(),
            agents: [
              'Tool Discovery Agent',
              'Workflow Builder Agent',
              'Suggestion Agent',
            ],
            stepCount: 3,
          },
        };

        draftContent = JSON.stringify(finalWorkflow, null, 2);

        dataStream.writeData({
          type: 'flowchart-delta',
          content: draftContent,
        });
      } catch (error) {
        console.error('Flowchart generation error:', error);

        // Fallback workflow
        const fallbackWorkflow = {
          query: title,
          workflow: { nodes: [], edges: [] },
          suggestions: {
            suggestions: ['Error occurred during workflow generation'],
            modifications: [],
            nextSteps: ['Please try again'],
          },
          error: error instanceof Error ? error.message : 'Unknown error',
        };

        draftContent = JSON.stringify(fallbackWorkflow, null, 2);

        dataStream.writeData({
          type: 'flowchart-delta',
          content: draftContent,
        });
      } finally {
        if (mcpClient) {
          mcpClient.close?.();
        }
      }

      return draftContent;
    },
    onUpdateDocument: async ({ document, description, dataStream }) => {
      let draftContent = '';
      const provider = getModelProvider(
        selectedChatModel,
        selectedChatModelProvider,
      );

      const model = provider.languageModel('artifact-model');

      try {
        // Parse existing workflow
        const existingWorkflow = JSON.parse(document.content || '{}');

        // Initialize MCP client
        let mcpClient: any = null;
        try {
          mcpClient = await createMCPClient();
        } catch (error) {
          console.error('Failed to create MCP client:', error);
        }

        // Use the three-agent system to update the workflow
        dataStream.writeData({
          type: 'flow-step',
          content: JSON.stringify({
            step: 1,
            agent: 'Tool Discovery Agent',
            status: 'running',
            message: 'Re-evaluating tools for updates...',
          }),
        });

        const toolDiscovery = await toolDiscoveryAgent(
          `${existingWorkflow.query}. Update request: ${description}`,
          mcpClient,
          model,
        );

        dataStream.writeData({
          type: 'flow-step',
          content: JSON.stringify({
            step: 2,
            agent: 'Workflow Builder Agent',
            status: 'running',
            message: 'Updating workflow...',
          }),
        });

        const workflowResult = await workflowBuilderAgent(
          `Update existing workflow. Original: ${existingWorkflow.query}. Update: ${description}`,
          toolDiscovery.selectedTools,
          model,
          mcpClient,
        );

        dataStream.writeData({
          type: 'flow-step',
          content: JSON.stringify({
            step: 3,
            agent: 'Suggestion Agent',
            status: 'running',
            message: 'Generating new suggestions...',
          }),
        });

        const suggestions = await suggestionAgent(
          `${existingWorkflow.query}. Update: ${description}`,
          workflowResult.workflow,
          workflowResult.toolSchemas,
          model,
        );

        // Create updated workflow
        const updatedWorkflow = {
          ...existingWorkflow,
          workflow: workflowResult.workflow,
          toolSchemas: workflowResult.toolSchemas,
          suggestions,
          lastUpdated: new Date().toISOString(),
          updateDescription: description,
        };

        draftContent = JSON.stringify(updatedWorkflow, null, 2);

        dataStream.writeData({
          type: 'flowchart-delta',
          content: draftContent,
        });

        if (mcpClient) {
          mcpClient.close?.();
        }
      } catch (error) {
        console.error('Flowchart update error:', error);
        draftContent = document.content ?? ''; // Keep original on error, fallback to empty string if null
      }

      return draftContent;
    },
  });
