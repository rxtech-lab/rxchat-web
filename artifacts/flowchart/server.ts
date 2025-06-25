import type { ProviderType } from '@/lib/ai/models';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { getUserContext } from '@/lib/db/queries/user';
import { getTextContentFromUserMessage } from '@/lib/utils.server';
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
    onCreateDocument: async ({ session, context, dataStream }) => {
      // Use context (original user query) if available, fallback to title
      const query = getTextContentFromUserMessage(context);
      const userContext = await getUserContext(session.user.id);
      const abortController = new AbortController();

      dataStream.onError?.(() => {
        abortController.abort();
      });

      const workflow = await agent(
        query,
        null,
        userContext,
        {},
        (step) => {
          dataStream.writeData({
            type: 'flowchart-step-delta',
            content: JSON.stringify(step, null, 2),
          });
        },
        abortController.signal,
      );

      dataStream.writeData({
        type: 'flowchart-delta',
        content: JSON.stringify(workflow, null, 2),
      });

      return JSON.stringify(workflow, null, 2);
    },
    onUpdateDocument: async ({
      document,
      description,
      dataStream,
      session,
    }) => {
      let workflow: Workflow | null = null;
      try {
        const parsed = JSON.parse(document.content as unknown as string);
        const data = OnStepSchema.safeParse(parsed);
        if (data.success) {
          workflow = data.data.workflow;
        }
      } catch {}

      const userContext = await getUserContext(session.user.id);
      const abortController = new AbortController();

      dataStream.onError?.(() => {
        abortController.abort();
      });

      const workflowResult = await agent(
        description,
        workflow,
        userContext,
        {},
        (step) => {
          dataStream.writeData({
            type: 'flowchart-step-delta',
            content: JSON.stringify(step, null, 2),
          });
        },
        abortController.signal,
      );
      const draftContent = JSON.stringify(workflowResult, null, 2);

      dataStream.writeData({
        type: 'flowchart-delta',
        content: draftContent,
      });

      return draftContent;
    },
  });
