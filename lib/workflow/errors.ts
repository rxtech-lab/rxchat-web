export class WorkflowEngineError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, WorkflowEngineError.prototype);
    this.name = 'WorkflowEngineError';
  }
}
