// Main component
export { MultimodalInput } from './multimodal-input';

// Individual components
export { AttachmentsPreview } from './attachments-preview';
export { InputArea } from './input-area';
export { ScrollToBottom } from './scroll-to-bottom';
export { PromptDialog } from './prompt-dialog';

// Hooks
export { useFileUpload } from './file-upload-handler';
export { useDocumentManager } from './document-manager';

// Utilities
export {
  getContentTypeFromFileName,
  getDocumentDownloadUrl,
} from './file-utils';

// Types
export type {
  UploadedDocument,
  ImageUploadResult,
  DocumentUploadResult,
  UploadResult,
  FileUploadProps,
  DocumentManagerProps,
} from './types';

// Existing components (re-export for convenience)
export { AttachmentsButton } from './attachment-button';
export { MCPButton } from './mcp-button';
export { SendButton, StopButton } from './send-button';
