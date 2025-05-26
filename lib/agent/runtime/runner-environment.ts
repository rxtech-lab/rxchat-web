import { transformSync } from '@swc/core';
import { VM } from 'vm2';
import { detectTypeScriptSyntax } from './helper';
import axios, { type AxiosRequestConfig } from 'axios';

/**
 * Creates a secure isolated environment to execute JavaScript code and function calls
 * @param code - The JavaScript code to execute in the isolated environment
 * @param functionCall - The function call expression to evaluate
 * @param syntax - Optional syntax type ('ecmascript' or 'typescript'). If not provided, auto-detects from code
 * @returns Promise that resolves to the result of the function call
 */
export async function createRunnerEnvironment(
  code: string,
  functionCall: string,
  syntax?: 'ecmascript' | 'typescript',
): Promise<any> {
  // Create a VM2 instance with security settings
  const vm = new VM({
    timeout: 5000, // 5 second timeout
    sandbox: {
      // Provide axios functionality
      axios: async (config: AxiosRequestConfig) => {
        try {
          const response = await axios.request(config);
          return {
            data: response.data,
            status: response.status,
            statusText: response.statusText,
          };
        } catch (error) {
          throw new Error(
            `Axios error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      },
    },
  });

  try {
    // Compile the user code with swc
    const compiledCode = await compileCode(code, syntax);

    // Execute the compiled code in the VM
    vm.run(compiledCode);

    // Execute the function call and get the result
    const result = vm.run(functionCall);

    return result;
  } catch (error) {
    throw new Error(
      `Runtime error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Compile user source code using swc
 * @param code Source code from user
 * @param syntax Optional syntax type ('ecmascript' or 'typescript'). If not provided, auto-detects from code
 * @returns Compiled JavaScript code compatible with the VM environment
 */
export async function compileCode(
  code: string,
  syntax?: 'ecmascript' | 'typescript',
): Promise<string> {
  // Auto-detect syntax if not provided
  const detectedSyntax =
    syntax || (detectTypeScriptSyntax(code) ? 'typescript' : 'ecmascript');

  const result = transformSync(code, {
    jsc: {
      parser:
        detectedSyntax === 'typescript'
          ? {
              syntax: 'typescript',
              tsx: false,
              decorators: false,
              dynamicImport: true,
            }
          : {
              syntax: 'ecmascript',
              jsx: false,
              dynamicImport: true,
              privateMethod: true,
              functionBind: false,
              exportDefaultFrom: false,
              exportNamespaceFrom: false,
              decorators: false,
              decoratorsBeforeExport: false,
              topLevelAwait: true,
              importMeta: false,
            },
      target: 'es2017', // Modern target for better async/await support
      loose: false,
      keepClassNames: true,
      externalHelpers: false,
      transform: {},
    },
    sourceMaps: false,
    isModule: false,
  });

  return result.code;
}
