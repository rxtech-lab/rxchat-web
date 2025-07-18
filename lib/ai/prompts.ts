import type { ArtifactKind } from '@/components/artifact';
import { createMemoryClient } from '@/lib/memory';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { Geo } from '@vercel/functions';
import type { Attachment } from 'ai';
import { createMarkitdownClient } from '../document/markitdown';

export const artifactsPrompt = `
Artifacts is a special user interface mode that helps users with writing, editing, and other content creation tasks. When artifact is open, it is on the right side of the screen, while the conversation is on the left side. When creating or updating documents, changes are reflected in real-time on the artifacts and visible to the user.

When asked to write code, always use artifacts. When writing code, specify the language in the backticks, e.g. \`\`\`python\`code here\`\`\`. The default language is Python. Other languages are not yet supported, so let the user know if they request a different language.

DO NOT UPDATE DOCUMENTS IMMEDIATELY AFTER CREATING THEM. WAIT FOR USER FEEDBACK OR REQUEST TO UPDATE IT.

This is a guide for using artifacts tools: \`createDocument\` and \`updateDocument\`, which render content on a artifacts beside the conversation.

**When to use \`createDocument\`:**
- For substantial content (>10 lines) or code
- For content users will likely save/reuse (emails, code, essays, etc.)
- When explicitly requested to create a document
- For when content contains a single code snippet

**When NOT to use \`createDocument\`:**
- For informational/explanatory content
- For conversational responses
- When asked to keep it in chat

**Using \`updateDocument\`:**
- Default to full document rewrites for major changes
- Use targeted updates only for specific, isolated changes
- Follow user instructions for which parts to modify

**When NOT to use \`updateDocument\`:**
- Immediately after creating a document

Do not update document right after creating it. Wait for user feedback or request to update it.
`;

export const regularPrompt = `
  You are a friendly assistant! Keep your responses concise and helpful. 
  When user asking something that you don't know, 
  If you think it is related to knowledge base, use searchDocuments tool to find the relevant documents.
  Otherwise, use query tool to find the appropriate tools to use or you think the document is not relevant to the user's request.
  **Important**: If user attached a document/pdf, and ask what is in the document, then you do not need to use searchDocuments tool.
  **Important** Always use query to first, then call schema to get the input and output of the tool, then use the tool.
  **Important** If you use useTool to call a tool and it returns a non empty url, don't include that URL in your final response. Don't say: You can complete the transaction here: https://someurl.com something like that.
  **Important** If user want to create a workflow, or intent to create a automated system, use createDocument tool to create a workflow.
  **Important** If user wants to create, manage, or track todo lists or tasks, suggest using the todo list management system which can help organize and track their work.

  If user says @tool-name, then you should look up the tool using schema tool and then use it. If tool requires input, then you should ask user for the input.
  If user says @document, perform a document search using searchDocuments tool. If user only says @document, then you should ask user for more details.
  If user says @workflow, create a workflow using createWorkflow tool with user requirements. If user only says @workflow, then you should ask user for more details.
  `;

export interface RequestHints {
  latitude: Geo['latitude'];
  longitude: Geo['longitude'];
  city: Geo['city'];
  country: Geo['country'];
  time: string;
}

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
- time: ${requestHints.time}
`;

export async function getDocumentPrompt(documentAttachments: Attachment[]) {
  const markitdown = createMarkitdownClient();
  // filter out image attachments
  const resultPromises = documentAttachments
    .filter((attachment) => !attachment.contentType?.startsWith('image/'))
    .map(async (attachment) => {
      const markdown = await markitdown.convertToMarkdown(attachment.url);
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 2500,
        chunkOverlap: 0,
      });
      const chunks = await splitter.splitText(markdown);

      // only return the first 2 chunks if the length of the chunks is less than 2500
      if (chunks.length < 2) {
        return chunks[0];
      }

      return chunks.slice(0, 2).join('\n\n');
    });

  const results = await Promise.all(resultPromises);
  const markdownContent = results.join('\n\n');

  return `
  The user has attached the following documents:
  ${markdownContent}
  `;
}

export const systemPrompt = async ({
  selectedChatModel,
  requestHints,
  isModelSupportedForDocuments,
  documentAttachments,
  useWebSearch = false,
}: {
  selectedChatModel: string;
  requestHints: RequestHints;
  isModelSupportedForDocuments: boolean;
  documentAttachments: Attachment[];
  useWebSearch?: boolean;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);
  const documentPrompt = await getDocumentPrompt(documentAttachments);

  // WebSearch instruction prompt
  const webSearchPrompt = useWebSearch
    ? `

IMPORTANT: The user has enabled web search for this message. You MUST use the searchWeb tool to search for current, relevant information to answer their question. Always prioritize using web search when this feature is enabled, even for questions you might know the answer to, as the user specifically wants current web-based information.`
    : '';

  if (selectedChatModel === 'chat-model-reasoning') {
    return `${documentPrompt}\n\n${regularPrompt}\n\n${requestPrompt}${webSearchPrompt}`;
  }

  return `${documentPrompt}\n\n${regularPrompt}\n\n${requestPrompt}\n\n${artifactsPrompt}${webSearchPrompt}`;
};

export const codePrompt = `
You are a Python code generator that creates self-contained, executable code snippets. When writing code:

1. Each snippet should be complete and runnable on its own
2. Prefer using print() statements to display outputs
3. Include helpful comments explaining the code
4. Keep snippets concise (generally under 15 lines)
5. Avoid external dependencies - use Python standard library
6. Handle potential errors gracefully
7. Return meaningful output that demonstrates the code's functionality
8. Don't use input() or other interactive functions
9. Don't access files or network resources
10. Don't use infinite loops

Examples of good snippets:

# Calculate factorial iteratively
def factorial(n):
    result = 1
    for i in range(1, n + 1):
        result *= i
    return result

print(f"Factorial of 5 is: {factorial(5)}")
`;

export const sheetPrompt = `
You are a spreadsheet creation assistant. Create a spreadsheet in csv format based on the given prompt. The spreadsheet should contain meaningful column headers and data.
`;

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: ArtifactKind,
) =>
  type === 'text'
    ? `\
Improve the following contents of the document based on the given prompt.

${currentContent}
`
    : type === 'code'
      ? `\
Improve the following code snippet based on the given prompt.

${currentContent}
`
      : type === 'sheet'
        ? `\
Improve the following spreadsheet based on the given prompt.

${currentContent}
`
        : '';

/**
 * Generate memory context from user's previous conversations
 * @param userMessage - The current user message to search for relevant memories
 * @param userId - The user ID to search memories for
 * @param shouldLoadMemory - Whether memory should be loaded (for optimization)
 * @returns Memory context string to append to system prompt
 */
export async function getMemoryContext(
  userMessage: string,
  userId: string,
  shouldLoadMemory = true,
): Promise<string> {
  // Skip memory loading if optimization conditions are not met
  if (!shouldLoadMemory) {
    return '';
  }
  try {
    const memoryClient = createMemoryClient();

    const memoryResults = await memoryClient.search(userMessage, {
      user_id: userId,
      limit: 5,
      version: 'v2',
      filters: {
        AND: [
          {
            user_id: userId,
          },
        ],
      },
    });

    if (memoryResults.results.length > 0) {
      const memories = memoryResults.results
        .map((result) => result.text)
        .join('\n');

      return `

Based on your previous conversations, here are some relevant memories:
${memories}

Please consider this context when responding to the user.`;
    }

    return '';
  } catch (error) {
    console.error('Failed to retrieve memory context:', error);
    // Return empty string if there's an error, don't break the main flow
    return '';
  }
}
