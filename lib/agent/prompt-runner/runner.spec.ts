import { createPromptRunner } from './runner';

describe('Prompt Runner', () => {
  it('should run the prompt function', async () => {
    const result = await createPromptRunner(`
      async function prompt(): Promise<string> {
        return "Hello world";
      }
    `);
    expect(result).toBe('Hello world');
  });
});
