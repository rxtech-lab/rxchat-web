// Document pagination utility functions
export interface DocumentHistory {
  documents: Array<{
    id: string;
    title: string;
    mimeType: string;
    size: number;
    createdAt: string;
    s3Key: string;
    content: string;
    userId: string;
    key: string | null;
    originalFileName: string;
  }>;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

export function getDocumentsPaginationKey(
  pageIndex: number,
  previousPageData: DocumentHistory,
  searchQuery?: string,
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  const baseUrl = '/api/documents';
  const params = new URLSearchParams();

  params.set('limit', PAGE_SIZE.toString());

  if (searchQuery) {
    params.set('query', searchQuery);
  }

  if (pageIndex === 0) {
    return `${baseUrl}?${params.toString()}`;
  }

  const firstDocumentFromPage = previousPageData.documents.at(-1);

  if (!firstDocumentFromPage) return null;

  params.set('ending_before', firstDocumentFromPage.id);

  return `${baseUrl}?${params.toString()}`;
}
