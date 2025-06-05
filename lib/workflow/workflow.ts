import type { Workflow } from './types';

interface WorkflowEngineInterface {
  /**
   * Execute the workflow follow the order using BFS.
   * @throws WorkflowEngineError if the workflow failed to execute
   */
  execute(workflow: Workflow): Promise<void>;
}

export class WorkflowEngine implements WorkflowEngineInterface {
  async execute(workflow: Workflow): Promise<void> {
    console.log(workflow);
  }
}
