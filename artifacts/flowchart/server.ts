import { createMCPClient } from '@/lib/ai/mcp';
import type { ProviderType } from '@/lib/ai/models';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { agent } from '@/lib/workflow/agent';
import { Workflow } from '@/lib/workflow/workflow';
import { z } from 'zod';

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
      const workflow = await agent(title);
      // Fallback workflow
      const workflowResult = {
        query: title,
        workflow: workflow?.workflow.getWorkflow(),
        suggestions: {
          suggestions: [],
          modifications: [],
          nextSteps: [],
        },
      };
      const draftContent = JSON.stringify(workflowResult, null, 2);

      dataStream.writeData({
        type: 'flowchart-delta',
        content: draftContent,
      });

      return draftContent;
    },
    onUpdateDocument: async ({ document, description, dataStream }) => {
      const workflowResult = await agent(description);
      const draftContent = JSON.stringify(workflowResult, null, 2);

      dataStream.writeData({
        type: 'flowchart-delta',
        content: draftContent,
      });

      return draftContent;
    },
  });
