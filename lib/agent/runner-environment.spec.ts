import { compileCode, createRunnerEnvironment } from './runner-environment';

describe('createRunnerEnvironment', () => {
  describe('Basic functionality', () => {
    it('should execute simple promise JavaScript code successfully', async () => {
      const result = await createRunnerEnvironment(
        `
     function prompt(systemPrompt) {
        return new Promise((resolve) => {
          resolve('Hello ' + systemPrompt);
        });
     }
      `,
        "prompt('hello')",
      );
      expect(result).toBe('Hello hello');
    });

    it('should execute simple promise JavaScript code successfully', async () => {
      const result = await createRunnerEnvironment(
          `
     function prompt(systemPrompt) {
        return new Promise(async (resolve) => {
          resolve('Hello ' + systemPrompt);
        });
     }
      `,
          "prompt('hello')",
      );
      expect(result).toBe('Hello hello');
    });


    it('should execute simple promise JavaScript code that returns an object successfully', async () => {
      const result = await createRunnerEnvironment(
        `
     function prompt(systemPrompt) {
        return new Promise((resolve) => {
          resolve({
            systemPrompt: systemPrompt,
          });
        });
     }
      `,
        "prompt('hello')",
      );
      expect(result).toEqual({
        systemPrompt: 'hello',
      });
    });

    it('should execute simple async JavaScript code successfully', async () => {
      const source = `
      async function prompt(systemPrompt) {
        return 'Hello ' + systemPrompt;
      }
      `;

      const result = await createRunnerEnvironment(
        await compileCode(source),
        "prompt('hello')",
      );
      expect(result).toBe('Hello hello');
    });

    it('should execute async function that returns an object code successfully', async () => {
      const source = `
      async function prompt(systemPrompt) {
        return {
          systemPrompt: systemPrompt,
        }
      }
      `;

      const result = await createRunnerEnvironment(
        await compileCode(source),
        "prompt('hello')",
      );
      expect(result).toEqual({
        systemPrompt: 'hello',
      });
    });

    it('should execute simple async typescript code successfully', async () => {
      const source = `
      async function prompt(systemPrompt: string) {
        return 'Hello ' + systemPrompt;
      }
      `;

      const result = await createRunnerEnvironment(
        await compileCode(source),
        "prompt('hello')",
      );
      expect(result).toBe('Hello hello');
    });
  });

  describe('HTTP functionality', () => {
    it('should successfully make GET request with fetch', async () => {
      const source = `
      async function makeRequest() {
        const response = await axios({
          url: 'https://jsonplaceholder.typicode.com/todos/1',
          method: 'GET',
        });
        return response.data;
      }
      `;

      const result = await createRunnerEnvironment(
        await compileCode(source),
        'makeRequest()',
      );

      expect(result).toEqual({
        userId: 1,
        id: 1,
        title: 'delectus aut autem',
        completed: false,
      });
    });
  });
});
