# Example Release Notes API Response

This is an example of the JSON format expected by the What's New feature.

## Sample API Response

```json
{
  "latestVersion": "1.3.0", 
  "releases": [
    {
      "version": "1.3.0",
      "releaseDate": "2024-01-20T10:00:00Z",
      "releaseNotes": "# 🎉 Version 1.3.0 - Major Update\n\n## ✨ New Features\n\n- **Enhanced Chat Interface**: Redesigned chat UI with better responsiveness\n- **Release Notes**: Added automatic What's New dialog for version updates\n- **Advanced Search**: Improved search functionality with filters\n\n## 🐛 Bug Fixes\n\n- Fixed memory leak in chat history\n- Resolved authentication timeout issues\n- Fixed responsive design on mobile devices\n\n## 🔧 Improvements\n\n- Performance optimizations for faster loading\n- Better error handling and user feedback\n- Improved accessibility features\n\n## 🚨 Breaking Changes\n\n- API endpoint `/api/v1/chat` has been deprecated, use `/api/v2/chat` instead\n- Configuration format has changed, please update your `.env` file"
    },
    {
      "version": "1.2.3",
      "releaseDate": "2024-01-15T14:30:00Z", 
      "releaseNotes": "# 🔧 Version 1.2.3 - Hotfix\n\n## 🐛 Bug Fixes\n\n- Fixed critical security vulnerability in user authentication\n- Resolved data corruption issue in document storage\n- Fixed crash when uploading large files\n\n## 🔧 Improvements\n\n- Enhanced error messages for better debugging\n- Improved logging for better monitoring"
    },
    {
      "version": "1.2.0", 
      "releaseDate": "2024-01-10T09:00:00Z",
      "releaseNotes": "# 🚀 Version 1.2.0 - Feature Release\n\n## ✨ New Features\n\n- **Document Collaboration**: Real-time collaborative editing\n- **Advanced Workflow Engine**: Create custom automation workflows\n- **Multi-language Support**: Added support for 15 new languages\n\n## 🐛 Bug Fixes\n\n- Fixed issue with file synchronization\n- Resolved UI glitches in dark mode\n- Fixed memory management issues\n\n## 🔧 Improvements\n\n- Faster document loading times\n- Better mobile experience\n- Enhanced security measures"
    },
    {
      "version": "1.1.0",
      "releaseDate": "2024-01-01T00:00:00Z",
      "releaseNotes": "# 🎊 Version 1.1.0 - New Year Release\n\n## ✨ New Features\n\n- **Dark Mode**: Toggle between light and dark themes\n- **Export Options**: Export documents in multiple formats\n- **User Preferences**: Customizable user settings\n\n## 🐛 Bug Fixes\n\n- Fixed login redirect issues\n- Resolved file upload timeout\n- Fixed notification display problems"
    }
  ]
}
```

## Environment Configuration

Add this to your `.env` or `.env.local`:

```bash
# What's New Feature Configuration
NEXT_PUBLIC_RELEASE_NOTE_URL=https://api.example.com/releases/notes.json
```

## Testing the Feature

You can test the feature by:

1. Setting up a mock API endpoint that returns the above JSON
2. Setting the environment variable 
3. Starting the application
4. The dialog should appear automatically if you haven't read the latest version

## Manual Testing Example

Create a simple test endpoint:

```javascript
// pages/api/test-release-notes.js (for testing)
export default function handler(req, res) {
  res.status(200).json({
    latestVersion: "1.3.0",
    releases: [
      {
        version: "1.3.0",
        releaseDate: new Date().toISOString(),
        releaseNotes: "# Test Release\n\nThis is a test release note!"
      }
    ]
  });
}
```

Then set:
```bash
NEXT_PUBLIC_RELEASE_NOTE_URL=http://localhost:3000/api/test-release-notes
```