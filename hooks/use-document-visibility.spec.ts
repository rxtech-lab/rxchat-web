/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useDocumentVisibility } from './use-document-visibility';

// Mock SWR
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn((key: string, fetcher: any, options: any) => ({
    data: options?.fallbackData,
    mutate: jest.fn(),
  })),
  useSWRConfig: jest.fn(() => ({
    mutate: jest.fn(),
  })),
}));

// Mock fetch
global.fetch = jest.fn();

describe('useDocumentVisibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  it('should initialize with the provided visibility type', () => {
    const { result } = renderHook(() =>
      useDocumentVisibility({
        documentId: 'doc-1',
        initialVisibilityType: 'private',
      }),
    );

    expect(result.current.visibilityType).toBe('private');
  });

  it('should update visibility type when setVisibilityType is called', async () => {
    const { result } = renderHook(() =>
      useDocumentVisibility({
        documentId: 'doc-1',
        initialVisibilityType: 'private',
      }),
    );

    await act(async () => {
      await result.current.setVisibilityType('public');
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/documents/doc-1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        visibility: 'public',
      }),
    });
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Update failed' }),
    });

    const { result } = renderHook(() =>
      useDocumentVisibility({
        documentId: 'doc-1',
        initialVisibilityType: 'private',
      }),
    );

    await expect(async () => {
      await act(async () => {
        await result.current.setVisibilityType('public');
      });
    }).rejects.toThrow('Update failed');
  });
});
