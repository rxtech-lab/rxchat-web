const {
  createRunnerEnvironment,
} = require('./lib/agent/runner-environment.ts');

(async () => {
  try {
    const result = await createRunnerEnvironment(
      'function prompt(systemPrompt) { return "Hello " + systemPrompt; }',
      'prompt("world")',
    );
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
