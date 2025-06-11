import { generateDummyPassword } from './db/utils';

export const isProductionEnvironment = process.env.NODE_ENV === 'production';
export const isDevelopmentEnvironment = process.env.NODE_ENV === 'development';
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT ||
    process.env.IS_TEST === 'true' ||
    process.env.NODE_ENV === 'test',
);

export const AUTO_REFRESH_INTERVAL = 30_000;

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export const DOCUMENTS_REFRESH_INTERVAL = 10_000;

export const MAX_CONTEXT_TOKEN_COUNT = 10_000;

export const ALLOWED_FILE_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/tiff',
  'image/bmp',
  'image/x-icon',
  // Documents
  'application/pdf',
  // Text files
  'text/plain',
  'text/markdown',
  'text/html',
  'text/css',
  'text/javascript',
  'text/csv',
  'text/xml',
  // Code files
  'application/json',
  'application/javascript',
  'application/typescript',
  'application/x-python',
  'application/x-java-source',
  'application/x-csharp',
  'application/x-php',
  'application/x-ruby',
  'application/x-go',
  'application/x-rust',
  'application/x-swift',
  'application/x-kotlin',
  'application/x-scala',
  'application/x-shell',
  'application/x-yaml',
  'application/x-toml',
];

// File type detection by extension (for files without proper MIME types)
export const FILE_EXTENSION_MIME_MAP: Record<string, string> = {
  // Text files
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.xml': 'text/xml',
  // Code files
  '.js': 'text/javascript',
  '.jsx': 'text/javascript',
  '.ts': 'application/typescript',
  '.tsx': 'application/typescript',
  '.json': 'application/json',
  '.py': 'application/x-python',
  '.java': 'application/x-java-source',
  '.cs': 'application/x-csharp',
  '.php': 'application/x-php',
  '.rb': 'application/x-ruby',
  '.go': 'application/x-go',
  '.rs': 'application/x-rust',
  '.swift': 'application/x-swift',
  '.kt': 'application/x-kotlin',
  '.scala': 'application/x-scala',
  '.sh': 'application/x-shell',
  '.bash': 'application/x-shell',
  '.zsh': 'application/x-shell',
  '.yml': 'application/x-yaml',
  '.yaml': 'application/x-yaml',
  '.toml': 'application/x-toml',
  '.c': 'text/plain',
  '.cpp': 'text/plain',
  '.h': 'text/plain',
  '.hpp': 'text/plain',
  '.sql': 'text/plain',
  '.r': 'text/plain',
  '.m': 'text/plain',
  '.vim': 'text/plain',
  '.dockerfile': 'text/plain',
  '.gitignore': 'text/plain',
  '.env': 'text/plain',
};

export const DEBOUNCE_TIME = 1000;

// Maximum number of documents to return in search results
export const MAX_K = 10;

export const CHUNK_SIZE = 1000;

export const MAX_WORKFLOW_RETRIES = 0;

/**
 * Array of image MIME types for easy filtering
 */
export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/tiff',
  'image/bmp',
  'image/x-icon',
];

/**
 * Check if a file type is an image
 * @param mimeType - The MIME type to check
 * @returns true if the MIME type is an image
 */
export const isImageType = (mimeType: string): boolean => {
  return IMAGE_MIME_TYPES.includes(mimeType);
};
