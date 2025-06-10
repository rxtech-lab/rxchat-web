export class WorkflowEngineError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, WorkflowEngineError.prototype);
    this.name = 'WorkflowEngineError';
  }
}

export class WorkflowInputOutputMismatchError extends WorkflowEngineError {
  errors: string[];
  suggestions: string[];
  constructor(errors: string[], suggestions: string[]) {
    super(
      `Input and output mismatch: ${errors.join(', ')}. Suggestions: ${suggestions.join(', ')}`,
    );
    Object.setPrototypeOf(this, WorkflowInputOutputMismatchError.prototype);
    this.name = 'WorkflowInputOutputMismatchError';
    this.errors = errors;
    this.suggestions = suggestions;
  }
}

export class WorkflowToolMissingError extends WorkflowEngineError {
  private missingTools: string[];
  constructor(missingTools: string[]) {
    super(
      `Tools missing: ${missingTools.join(', ')}. Please check if the tools are available in the MCP Router.`,
    );
    Object.setPrototypeOf(this, WorkflowToolMissingError.prototype);
    this.name = 'WorkflowToolMissingError';
    this.missingTools = missingTools;
  }

  getMissingTools(): string[] {
    return this.missingTools;
  }
}
