'server-only';

/**
 * Calculate SHA256 hash from file content downloaded from URL
 * @param fileUrl - URL to download the file from
 * @returns Promise<string> - SHA256 hash in hexadecimal format
 */
export async function calculateSha256FromUrl(fileUrl: string): Promise<string> {
  const crypto = await import('node:crypto');

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
  } catch (error) {
    throw new Error(
      `Failed to calculate SHA256: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
