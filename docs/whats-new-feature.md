# What's New Feature

This feature implements a "What's New" dialog that shows users release notes for the latest version when they haven't read them yet.

## Features

- **Automatic Display**: Shows dialog when user hasn't read the latest release notes
- **Version Tracking**: Uses cookies to track which version the user has read (`release-note-read: {{version}}`)
- **Semver Comparison**: Uses the `semver` library to compare versions and determine if user needs to see new release notes
- **Markdown Support**: Renders release notes in markdown format using the existing Markdown component
- **SWR Integration**: Fetches release notes with SWR for caching and automatic updates

## Configuration

Set the `NEXT_PUBLIC_RELEASE_NOTE_URL` environment variable to the URL of your release notes API endpoint.

Example:
```bash
NEXT_PUBLIC_RELEASE_NOTE_URL=https://api.github.com/repos/rxtech-lab/rxchat-web/releases/notes.json
```

## API Format

The release notes API should return JSON in the following format:

```json
{
  "latestVersion": "1.2.0",
  "releases": [
    {
      "version": "1.2.0", 
      "releaseDate": "2024-01-15T00:00:00Z",
      "releaseNotes": "# New Features\n\n- Added awesome feature\n- Fixed critical bug"
    },
    {
      "version": "1.1.0",
      "releaseDate": "2024-01-01T00:00:00Z", 
      "releaseNotes": "# Bug Fixes\n\n- Fixed minor issue"
    }
  ]
}
```

## Components

### `WhatsNewDialog`
The main dialog component that displays release notes.

**Props:**
- `open?: boolean` - Control dialog visibility manually
- `onOpenChange?: (open: boolean) => void` - Handle dialog state changes

### Hooks

#### `useReleaseNotes()`
SWR hook for fetching release notes data.

**Returns:**
- `releaseNotes` - The release notes data
- `isLoading` - Loading state
- `error` - Error state  
- `mutate` - SWR mutate function
- `isConfigured` - Whether the feature is configured

### Utilities

#### Release Notes Utilities (`lib/release-notes.ts`)

- `getReadVersion()` - Get the version the user has read from cookies
- `setReadVersion(version)` - Set the version the user has read
- `shouldShowReleaseNotes(latestVersion)` - Check if user should see release notes
- `fetchReleaseNotes()` - Fetch release notes from configured URL
- `getReleaseNoteByVersion(releases, version)` - Get specific release note by version

## Behavior

1. When the app loads, it checks if `NEXT_PUBLIC_RELEASE_NOTE_URL` is configured
2. If configured, it fetches the release notes using SWR
3. It compares the latest version with the user's read version using semver
4. If the user hasn't read the latest version, the dialog automatically appears
5. User can close the dialog or click "I've Read This" to mark it as read
6. The read version is stored in a cookie that expires in 1 year

## Integration

The `WhatsNewDialog` is automatically integrated into the root layout (`app/layout.tsx`) and will show automatically when appropriate.

## Testing

The feature includes comprehensive unit tests:
- `lib/release-notes.spec.ts` - Tests for utility functions
- `components/whats-new-dialog.spec.tsx` - Tests for the dialog component

Run tests with:
```bash
pnpm test:unit -- lib/release-notes.spec.ts components/whats-new-dialog.spec.tsx
```