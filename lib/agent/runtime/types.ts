export interface ExecutionRequest {
  code: string;
}

export interface ExecutionResponse {
  success: boolean;
  result?: any;
  message?: string;
  error?: string;
}

export interface SafeFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text: () => Promise<string>;
  json: () => Promise<any>;
}

export interface AxiosLikeResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface AxiosLikeInstance {
  get<T = any>(
    url: string,
    config?: RequestConfig,
  ): Promise<AxiosLikeResponse<T>>;
  post<T = any>(
    url: string,
    data?: any,
    config?: RequestConfig,
  ): Promise<AxiosLikeResponse<T>>;
  put<T = any>(
    url: string,
    data?: any,
    config?: RequestConfig,
  ): Promise<AxiosLikeResponse<T>>;
  delete<T = any>(
    url: string,
    config?: RequestConfig,
  ): Promise<AxiosLikeResponse<T>>;
}

export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
}

export interface SandboxConsole {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
}
