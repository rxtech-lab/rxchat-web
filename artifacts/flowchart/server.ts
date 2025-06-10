import type { ProviderType } from '@/lib/ai/models';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { agent } from '@/lib/workflow/agent';
import { OnStepSchema } from '@/lib/workflow/types';
import type { Workflow } from '@/lib/workflow/workflow';

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
      const workflow = await agent(title, null, (step) => {
        dataStream.writeData({
          type: 'flowchart-step-delta',
          content: JSON.stringify(step, null, 2),
        });
      });

      dataStream.writeData({
        type: 'flowchart-delta',
        content: JSON.stringify(workflow, null, 2),
      });

      return JSON.stringify(workflow, null, 2);
    },
    onUpdateDocument: async ({ document, description, dataStream }) => {
      let workflow: Workflow | null = null;
      try {
        const parsed = JSON.parse(document.content as unknown as string);
        const data = OnStepSchema.safeParse(parsed);
        if (data.success) {
          workflow = data.data.workflow;
        }
      } catch {}

      const workflowResult = await agent(description, workflow, (step) => {
        dataStream.writeData({
          type: 'flowchart-step-delta',
          content: JSON.stringify(step, null, 2),
        });
      });
      const draftContent = JSON.stringify(workflowResult, null, 2);

      dataStream.writeData({
        type: 'flowchart-delta',
        content: draftContent,
      });

      return draftContent;
    },
  });
