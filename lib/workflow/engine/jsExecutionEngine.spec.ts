import { createJSExecutionEngine } from './jsExecutionEngine';

describe('Execute JS Engine', () => {
  const testCases: {
    input: any;
    title: string;
  }[] = [
    {
      title: 'Empty Object input',
      input: {},
    },
    {
      title: 'Empty Array input',
      input: [],
    },
    {
      title: 'Empty String input',
      input: '',
    },
    {
      title: 'String input',
      input: 'Hello',
    },
    {
      title: 'Number input',
      input: 0,
    },
    {
      title: 'Boolean input',
      input: false,
    },
    {
      title: 'Null input',
      input: null,
    },
  ];

  for (const testCase of testCases) {
    it(`should execute the JS code with input ${testCase.title}`, async () => {
      const engine = createJSExecutionEngine();
      const code = `
        async function handle(input: any): Promise<any> {
          return input;
        }
      `;
      const result = await engine.execute(testCase.input, code, {});
      expect(result).toStrictEqual(testCase.input);
    });
  }
});
