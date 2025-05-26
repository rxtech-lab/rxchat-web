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

  it('should run the prompt function with axios', async () => {
    const result = await createPromptRunner(`
      async function prompt(): Promise<string> {
      const url = 'https://jsonplaceholder.typicode.com/posts';
      const response = await axios({
        url,
        method: 'GET',
      });
      return JSON.stringify(response.data);
    }
    `);
    expect(result.length).toBeGreaterThan(0);
  });
});
