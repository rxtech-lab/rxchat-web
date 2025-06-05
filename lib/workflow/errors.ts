export class WorkflowEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowEngineError';
  }
}
