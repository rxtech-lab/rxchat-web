import type { Tool } from '@/lib/api/mcp-router/client';
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedTextNode,
  Spread,
} from 'lexical';
import { $applyNodeReplacement, TextNode } from 'lexical';

export type SerializedMentionNode = Spread<
  {
    tool: Tool;
  },
  SerializedTextNode
>;

function convertMentionElement(
  domNode: HTMLElement,
): DOMConversionOutput | null {
  const textContent = domNode.textContent;

  if (textContent !== null) {
    const node = $createMentionNode({
      identifier: textContent,
      title: textContent,
      description: textContent,
      inputSchema: {},
      outputSchema: {},
      sha256: '',
    });
    return {
      node,
    };
  }

  return null;
}

const mentionStyle =
  'background-color: rgba(24, 119, 232, 0.1); color: rgb(24, 119, 232); border-radius: 6px; padding: 2px 4px; margin: 0 1px;';

export class MentionNode extends TextNode {
  __tool: Tool;

  static getType(): string {
    return 'mention';
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__tool, node.__key);
  }

  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    const node = $createMentionNode(serializedNode.tool);
    node.setTextContent(serializedNode.tool.identifier);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  constructor(tool: Tool, key?: NodeKey) {
    super(`@${tool.identifier}`, key);
    this.__tool = tool;
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      tool: this.__tool,
      type: 'mention',
      version: 1,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.style.cssText = mentionStyle;
    dom.className = 'mention';
    return dom;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span');
    element.setAttribute('data-lexical-mention', 'true');
    element.textContent = this.__tool.identifier;
    element.style.cssText = mentionStyle;
    element.className = 'mention';
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute('data-lexical-mention')) {
          return null;
        }
        return {
          conversion: convertMentionElement,
          priority: 1,
        };
      },
    };
  }

  isTextEntity(): true {
    return true;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }
}

export function $createMentionNode(tool: Tool): MentionNode {
  const mentionNode = new MentionNode(tool);
  mentionNode.setMode('segmented').toggleDirectionless();
  return $applyNodeReplacement(mentionNode);
}

export function $isMentionNode(
  node: LexicalNode | null | undefined,
): node is MentionNode {
  return node instanceof MentionNode;
}
