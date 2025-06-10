import type {
  AddMemoryOptions,
  AddMemoryResponse,
  MemoryMessage,
  MemoryClient,
  SearchMemoryOptions,
  SearchMemoryResponse,
} from './types';

export class MockClient implements MemoryClient {
  async search(
    query: string,
    options: SearchMemoryOptions,
  ): Promise<SearchMemoryResponse> {
    return {
      results: [],
    };
  }
  async delete(memoryId: string): Promise<void> {
    return;
  }
  async add(
    messages: MemoryMessage[],
    options: AddMemoryOptions,
  ): Promise<AddMemoryResponse> {
    return {
      message: 'Memory added',
    };
  }
}
