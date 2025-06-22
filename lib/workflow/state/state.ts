// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
export interface SetStateOptions {}

export interface GetStateOptions extends SetStateOptions {}

export interface DeleteStateOptions extends SetStateOptions {}

export interface ClearStateOptions extends SetStateOptions {}

export interface GetAllStateOptions extends SetStateOptions {}

export interface StateClient {
  /**
   * Set state value for a given key
   * @param key - The key to set the state value for
   * @param value - The value to set
   * @param options - The options for the state
   */
  setState<T>(key: string, value: T, options?: SetStateOptions): Promise<void>;

  /**
   * Get state value for a given key
   * @param key - The key to get the state value for
   * @param options - The options for the state
   */
  getState<T>(key: string, options?: GetStateOptions): Promise<T | null>;

  /**
   * Delete state value for a given key
   */
  deleteState(key: string, options?: DeleteStateOptions): Promise<void>;

  /**
   * Clear all state values
   * @param options - The options for the state
   */
  clearState(options?: ClearStateOptions): Promise<void>;

  /**
   * Get all state values
   * @param options - The options for the state
   */
  getAllState(options?: GetAllStateOptions): Promise<Record<string, any>>;
}
