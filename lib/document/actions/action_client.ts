import { completeDocumentUpload, getPresignedUploadUrl } from './action_server';

export async function createDocuments(fileList: FileList | null) {
  const files = fileList ? Array.from(fileList) : null;
  if (!files || files.length === 0) return;

  for (const file of files) {
    // get the presigned URL from the API
    const presigned = await getPresignedUploadUrl({
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });
    if ('error' in presigned) {
      throw new Error(`Failed to get presigned URL for ${file.name}`);
    }

    // upload the file to S3 using the presigned URL
    const response = await fetch(presigned.url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'Content-Length': file.size.toString(),
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload ${file.name}: ${response.statusText}`);
    }

    // call complete upload API to finalize the document creation
    const completeResponse = await completeDocumentUpload({
      documentId: presigned.id,
    });
    if ('error' in completeResponse) {
      throw new Error(
        `Failed to complete upload for ${file.name}: ${completeResponse.error}`,
      );
    }
  }
}
