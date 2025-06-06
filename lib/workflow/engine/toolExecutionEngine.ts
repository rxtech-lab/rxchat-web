import type { ToolExecutionEngine } from '../workflow-engine';

export class McpToolExecutionEngine implements ToolExecutionEngine {
  async execute(tool: string, input: any): Promise<any> {
    return 'not-implemented';
  }
}

export const createToolExecutionEngine = (): ToolExecutionEngine => {
  return new McpToolExecutionEngine();
};
