/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WhatsNewDialog } from './whats-new-dialog';
import { useReleaseNotes } from '@/hooks/use-release-notes';
import { shouldShowReleaseNotes, setReadVersion } from '@/lib/release-notes';

// Mock the hooks and utilities
jest.mock('@/hooks/use-release-notes');
jest.mock('@/lib/release-notes', () => ({
  ...jest.requireActual('@/lib/release-notes'),
  shouldShowReleaseNotes: jest.fn(),
  setReadVersion: jest.fn(),
  getReleaseNoteByVersion: jest.fn(),
}));

// Mock the Markdown component to avoid ESM issues in tests
jest.mock('@/components/markdown', () => ({
  Markdown: ({ children }: { children: string }) => (
    <div data-testid="markdown-content">{children}</div>
  ),
}));

const mockUseReleaseNotes = useReleaseNotes as jest.MockedFunction<
  typeof useReleaseNotes
>;
const mockShouldShowReleaseNotes =
  shouldShowReleaseNotes as jest.MockedFunction<typeof shouldShowReleaseNotes>;
const mockSetReadVersion = setReadVersion as jest.MockedFunction<
  typeof setReadVersion
>;

// Mock the getReleaseNoteByVersion function
const mockGetReleaseNoteByVersion = require('@/lib/release-notes')
  .getReleaseNoteByVersion as jest.MockedFunction<any>;

const mockReleaseNotesData = {
  latestVersion: '1.2.0',
  releases: [
    {
      version: '1.2.0',
      releaseDate: '2024-01-15T00:00:00Z',
      releaseNotes:
        '# New Features\n\n- Added awesome feature\n- Fixed critical bug',
    },
    {
      version: '1.1.0',
      releaseDate: '2024-01-01T00:00:00Z',
      releaseNotes: '# Bug Fixes\n\n- Fixed minor issue',
    },
  ],
};

describe('WhatsNewDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation
    mockGetReleaseNoteByVersion.mockImplementation((releases, version) => {
      return releases.find((r: any) => r.version === version) || null;
    });
  });

  it('should not render when not configured', () => {
    mockUseReleaseNotes.mockReturnValue({
      releaseNotes: null,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isConfigured: false,
    });

    const { container } = render(<WhatsNewDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('should not render when no release notes data', () => {
    mockUseReleaseNotes.mockReturnValue({
      releaseNotes: null,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isConfigured: true,
    });

    const { container } = render(<WhatsNewDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('should automatically show dialog when user should see release notes', async () => {
    mockUseReleaseNotes.mockReturnValue({
      releaseNotes: mockReleaseNotesData,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isConfigured: true,
    });

    mockShouldShowReleaseNotes.mockReturnValue(true);

    render(<WhatsNewDialog />);

    await waitFor(() => {
      expect(screen.getByText("What's New in v1.2.0")).toBeInTheDocument();
    });

    expect(
      screen.getByText('Released on January 15, 2024'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
  });

  it('should not automatically show when user should not see release notes', () => {
    mockUseReleaseNotes.mockReturnValue({
      releaseNotes: mockReleaseNotesData,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isConfigured: true,
    });

    mockShouldShowReleaseNotes.mockReturnValue(false);

    render(<WhatsNewDialog />);

    expect(screen.queryByText("What's New in v1.2.0")).not.toBeInTheDocument();
  });

  it('should show controlled dialog when open prop is true', () => {
    mockUseReleaseNotes.mockReturnValue({
      releaseNotes: mockReleaseNotesData,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isConfigured: true,
    });

    render(<WhatsNewDialog open={true} />);

    expect(screen.getByText("What's New in v1.2.0")).toBeInTheDocument();
  });

  it('should handle "I\'ve Read This" button click', async () => {
    const mockOnOpenChange = jest.fn();

    mockUseReleaseNotes.mockReturnValue({
      releaseNotes: mockReleaseNotesData,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isConfigured: true,
    });

    render(<WhatsNewDialog open={true} onOpenChange={mockOnOpenChange} />);

    const readButton = screen.getByText("I've Read This");
    fireEvent.click(readButton);

    expect(mockSetReadVersion).toHaveBeenCalledWith('1.2.0');
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('should handle "Close" button click', () => {
    const mockOnOpenChange = jest.fn();

    mockUseReleaseNotes.mockReturnValue({
      releaseNotes: mockReleaseNotesData,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isConfigured: true,
    });

    render(<WhatsNewDialog open={true} onOpenChange={mockOnOpenChange} />);

    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockSetReadVersion).not.toHaveBeenCalled();
  });

  it('should show loading state', () => {
    mockUseReleaseNotes.mockReturnValue({
      releaseNotes: mockReleaseNotesData,
      isLoading: true,
      error: null,
      mutate: jest.fn(),
      isConfigured: true,
    });

    render(<WhatsNewDialog open={true} />);

    expect(screen.getByText("What's New in v1.2.0")).toBeInTheDocument();
    // Loading spinner should be present
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should show error state', () => {
    mockUseReleaseNotes.mockReturnValue({
      releaseNotes: mockReleaseNotesData,
      isLoading: false,
      error: new Error('Network error'),
      mutate: jest.fn(),
      isConfigured: true,
    });

    render(<WhatsNewDialog open={true} />);

    expect(
      screen.getByText('Failed to load release notes'),
    ).toBeInTheDocument();
    expect(screen.getByText('Please try again later')).toBeInTheDocument();
  });

  it('should not render when latest release is not found', () => {
    mockUseReleaseNotes.mockReturnValue({
      releaseNotes: mockReleaseNotesData,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isConfigured: true,
    });

    // Mock getReleaseNoteByVersion to return null
    mockGetReleaseNoteByVersion.mockReturnValue(null);

    const { container } = render(<WhatsNewDialog open={true} />);
    expect(container.firstChild).toBeNull();
  });
});
