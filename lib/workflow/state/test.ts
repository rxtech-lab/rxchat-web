import type {
  ClearStateOptions,
  DeleteStateOptions,
  GetAllStateOptions,
  GetStateOptions,
  StateClient,
} from './state';

export class TestStateClient implements StateClient {
  private state: Record<string, any> = {};

  constructor(private readonly namespace: string = 'default') {}
  getState<T>(key: string, options?: GetStateOptions): Promise<T | null> {
    return Promise.resolve(this.state[key] as T);
  }
  deleteState(key: string, options?: DeleteStateOptions): Promise<void> {
    delete this.state[key];
    return Promise.resolve();
  }
  clearState(options?: ClearStateOptions): Promise<void> {
    this.state = {};
    return Promise.resolve();
  }
  getAllState(options?: GetAllStateOptions): Promise<Record<string, any>> {
    return Promise.resolve(this.state);
  }

  async setState(key: string, value: any): Promise<void> {
    this.state[key] = value;
  }
}

export const createTestStateClient = (namespace = 'default') =>
  new TestStateClient(namespace);
