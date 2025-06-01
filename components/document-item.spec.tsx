/**
 * @jest-environment jsdom
 */
import { SidebarProvider } from '@/components/ui/sidebar';

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DocumentItem } from './document-item';
import type { VectorStoreDocument } from '@/lib/db/schema';

describe('DocumentItem', () => {
  const mockDocument: VectorStoreDocument = {
    id: 'doc-1',
    userId: 'user-1',
    originalFileName: 'test-document.pdf',
    mimeType: 'application/pdf',
    content: '',
    size: 1024000,
    key: 'documents/test-document.pdf',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    status: 'completed',
  };

  const mockProps = {
    vectorDocument: mockDocument,
    onDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders document information correctly', () => {
    render(
      <SidebarProvider>
        <DocumentItem {...mockProps} />
      </SidebarProvider>,
    );

    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
  });

  it('formats file size correctly for different sizes', () => {
    const testCases = [
      { size: 500, expected: '500 Bytes' },
      { size: 1024, expected: '1 KB' },
      { size: 1048576, expected: '1 MB' },
      { size: 1073741824, expected: '1 GB' },
    ];

    testCases.forEach(({ size, expected }) => {
      const documentWithSize = { ...mockDocument, size };
      const { rerender } = render(
        <SidebarProvider>
          <DocumentItem {...mockProps} vectorDocument={documentWithSize} />
        </SidebarProvider>,
      );

      expect(screen.getByText(expected)).toBeInTheDocument();

      // Clean up for next iteration
      rerender(<div />);
    });
  });
});
