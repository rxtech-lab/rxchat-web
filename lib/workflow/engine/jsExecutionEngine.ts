import { createRunnerEnvironment } from '@/lib/agent/runtime/runner-environment';
import type { JSCodeExecutionEngine } from '../workflow-engine';

export class JSExecutionEngine implements JSCodeExecutionEngine {
  async execute(input: any, code: string, context: any): Promise<unknown> {
    const stringifiedInput = JSON.stringify(input);
    const contextString = JSON.stringify(context);
    return await createRunnerEnvironment(
      code,
      `handle(${stringifiedInput}, ${contextString})`,
      'typescript',
    );
  }
}

export const createJSExecutionEngine = (): JSCodeExecutionEngine => {
  return new JSExecutionEngine();
};
