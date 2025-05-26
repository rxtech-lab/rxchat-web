'server-only';

import { createRunnerEnvironment } from '../runtime/runner-environment';

/**
 * Run the prompt function in a sandboxed environment.
 *
 * @param code - The code to run.
 * @returns The result of the prompt function.
 */
export async function createPromptRunner(code: string): Promise<string> {
  const result = await createRunnerEnvironment(code, 'prompt()', 'typescript');
  if (typeof result === 'string') {
    return result;
  } else {
    throw new Error(
      `The result of the prompt function must be a string but got ${typeof result}`,
    );
  }
}
