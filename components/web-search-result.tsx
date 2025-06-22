'use client';

import { Globe, ExternalLink } from 'lucide-react';
import { memo } from 'react';

interface WebSearchMetadata {
  title: string;
  url: string;
}

interface WebSearchResults {
  keyword: string;
  summary: string;
  results: WebSearchMetadata[];
}

interface WebSearchResultProps {
  result: WebSearchResults;
  isReadonly: boolean;
}

const PureWebSearchResult = ({ result }: WebSearchResultProps) => {
  const { results } = result;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center gap-2">
        <Globe size={16} className="text-blue-600" />
        <h3 className="font-medium text-sm">Web Search Results</h3>
      </div>

      {results && results.length > 0 && (
        <div className="space-y-2">
          <div className="grid gap-2">
            {results.map((item) => (
              <a
                key={`web-search-result-${item.url}`}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 border rounded hover:bg-muted/50 transition-colors group"
              >
                <ExternalLink
                  size={14}
                  className="mt-0.5 text-muted-foreground group-hover:text-blue-600 transition-colors shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-blue-600 transition-colors line-clamp-2">
                    {item.title}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const WebSearchResult = memo(PureWebSearchResult);
