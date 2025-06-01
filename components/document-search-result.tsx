'use client';

import { Calendar, Download, File, FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Collapsible } from './ui/collapsible';

interface SearchResult {
  id: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  createdAt: string | Date;
  content: string;
}

interface DocumentSearchResultProps {
  result: {
    message: string;
    results: SearchResult[];
    error?: string;
  };
  isReadonly?: boolean;
}

/**
 * Formats file size from bytes to human readable format
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Formats date to locale string
 * @param date - Date to format
 * @returns Formatted date string
 */
const formatDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Gets appropriate icon for file type based on MIME type
 * @param mimeType - MIME type of the file
 * @returns React component for the icon
 */
const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('text/')) {
    return <FileText className="size-4" />;
  }
  return <File className="size-4" />;
};

/**
 * Individual search result item component
 * @param result - Single search result
 * @param isReadonly - Whether the component is in readonly mode
 */
const SearchResultItem = ({
  result,
  isReadonly,
}: {
  result: SearchResult;
  isReadonly?: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  /**
   * Handles downloading the document
   */
  const handleDownload = async () => {
    const promise = async () => {
      const response = await fetch(`/api/documents/${result.id}/download`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get download link');
      }

      const data = await response.json();

      // Open the document in a new tab instead of downloading
      window.open(data.url, '_blank');
    };

    toast.promise(promise, {
      loading: 'Opening document...',
      success: 'Document opened in new tab',
      error: 'Failed to download document',
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getFileIcon(result.mimeType)}
            <CardTitle className="text-sm font-medium">
              {result.originalFileName}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {result.mimeType}
            </Badge>
            {!isReadonly && (
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0"
                onClick={handleDownload}
                title="Download document"
              >
                <Download className="size-4" />
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {formatDate(result.createdAt)}
          </span>
          <span>{formatFileSize(result.size)}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground line-clamp-3 overflow-hidden break-all">
              {result.content}
            </div>
          </div>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

/**
 * DocumentSearchResult component displays search results from the searchDocuments tool
 * Shows a list of found documents with their metadata and content previews
 * @param result - Search results containing message, results array, and optional error
 * @param isReadonly - Whether the component is in readonly mode
 */
export const DocumentSearchResult = ({
  result,
  isReadonly = false,
}: DocumentSearchResultProps) => {
  // Handle error state
  if (result.error) {
    return (
      <div className="w-full p-4 border border-red-200 rounded-lg bg-red-50">
        <div className="flex items-center gap-2 text-red-700">
          <File className="size-4" />
          <span className="font-medium">Search Error</span>
        </div>
        <p className="text-sm text-red-600 mt-1">{result.error}</p>
      </div>
    );
  }

  // Handle empty results
  if (!result.results || result.results.length === 0) {
    return (
      <div className="w-full p-6 border border-gray-200 rounded-lg bg-gray-50">
        <div className="text-center">
          <File className="size-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">{result.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Results header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <File className="size-4" />
        <span>{result.message}</span>
      </div>

      {/* Results list */}
      <div className="space-y-3">
        {result.results.map((searchResult) => (
          <SearchResultItem
            key={searchResult.id}
            result={searchResult}
            isReadonly={isReadonly}
          />
        ))}
      </div>
    </div>
  );
};
