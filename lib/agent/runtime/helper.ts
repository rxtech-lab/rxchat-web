import type { SandboxConsole } from './types';

/**
 * Auto-detect if code contains TypeScript syntax
 * @param code Source code to analyze
 * @returns true if TypeScript syntax is detected
 */
export function detectTypeScriptSyntax(code: string): boolean {
  // Common TypeScript patterns
  const typeScriptPatterns = [
    /:\s*(string|number|boolean|object|any|void|null|undefined)\b/, // Type annotations
    /interface\s+\w+/, // Interface declarations
    /type\s+\w+\s*=/, // Type aliases
    /enum\s+\w+/, // Enum declarations
    /<[^>]*>/, // Generic types (basic detection)
    /as\s+\w+/, // Type assertions
    /public\s+|private\s+|protected\s+|readonly\s+/, // Access modifiers
    /\?\s*:/, // Optional properties
    /\|\s*\w+/, // Union types
    /&\s*\w+/, // Intersection types
  ];

  return typeScriptPatterns.some((pattern) => pattern.test(code));
}

function isValidUrl(url: string): boolean {
  try {
    const parsed: URL = new URL(url);

    // Only allow HTTP and HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Block private IP ranges and localhost
    const hostname: string = parsed.hostname;
    const privateIpPatterns: RegExp[] = [
      /^localhost$/i,
      /^127\./,
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^169\.254\./, // Link-local
      /^::1$/, // IPv6 localhost
      /^fc00:/, // IPv6 private
      /^fe80:/, // IPv6 link-local
    ];

    return !privateIpPatterns.some((pattern: RegExp) => pattern.test(hostname));
  } catch {
    return false;
  }
}

export { isValidUrl };
