/**
 * Extract MIME type detection logic based on file extension
 * @param fileName - The name of the file to detect content type for
 * @returns The MIME type string
 */
export function getContentTypeFromFileName(fileName: string): string {
  const fileExtension = fileName.toLowerCase().split('.').pop();

  switch (fileExtension) {
    case 'pdf':
      return 'application/pdf';
    case 'txt':
    case 'md':
      return 'text/plain';
    case 'html':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'js':
    case 'jsx':
      return 'application/javascript';
    case 'ts':
    case 'tsx':
      return 'application/typescript';
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
    case 'csv':
      return 'text/csv';
    case 'yml':
    case 'yaml':
      return 'application/yaml';
    default:
      return 'text/plain'; // Assume text for unknown file types
  }
}

/**
 * Get download URL for a document
 * @param documentId - The ID of the document
 * @returns Promise that resolves to the download URL or null if failed
 */
export async function getDocumentDownloadUrl(
  documentId: string,
): Promise<string | null> {
  try {
    const response = await fetch(`/api/documents/${documentId}/download`);
    if (!response.ok) {
      throw new Error('Failed to get download URL');
    }
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Error getting document download URL:', error);
    return null;
  }
}
