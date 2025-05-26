# Enhanced Monaco Editor

This enhanced Monaco Editor component provides advanced features including axios LSP support and cmd+s formatting functionality.

## Features

### 1. Axios LSP Support

The editor automatically injects axios type definitions into Monaco's TypeScript environment, providing:

- Full IntelliSense for axios methods (`get`, `post`, `put`, `delete`, etc.)
- Type checking for axios configuration objects
- Error handling with `axios.isAxiosError()`
- Support for axios instances created with `axios.create()`

### 2. Cmd+S Code Formatting

Instead of triggering the browser's save dialog, pressing `Cmd+S` (or `Ctrl+S`) will:

- Format the current code using Monaco's built-in formatter
- Prevent the default browser save behavior
- Provide visual feedback if formatting fails

### 3. Enhanced IntelliSense

The editor includes comprehensive IntelliSense settings:

- Method and function suggestions
- Variable and property suggestions
- Enhanced TypeScript support
- Common utility types (`Partial`, `Required`, `Pick`, `Omit`)

### 4. Global Type Definitions

Pre-loaded type definitions for:

- Axios HTTP client
- Fetch API
- Common TypeScript utility types
- Window object extensions

## Usage

### Basic Usage

```tsx
import { MonacoEditor } from "./components/ui/monaco-editor";

function MyComponent() {
  const [code, setCode] = useState("");

  return (
    <MonacoEditor
      value={code}
      onChange={setCode}
      language="typescript"
      height="400px"
    />
  );
}
```

### With Axios Support

```tsx
// The editor automatically provides IntelliSense for this code:
const code = `
import axios from 'axios';

async function fetchData() {
  const response = await axios.get('/api/data', {
    headers: { 'Authorization': 'Bearer token' },
    timeout: 5000
  });
  
  return response.data;
}
`;

<MonacoEditor value={code} onChange={setCode} language="typescript" />;
```

### Example Component

Use the provided example component to see all features in action:

```tsx
import { MonacoEditorExample } from "./components/ui/monaco-editor-example";

function App() {
  return <MonacoEditorExample />;
}
```

## Props

| Prop          | Type                                   | Default                     | Description                                  |
| ------------- | -------------------------------------- | --------------------------- | -------------------------------------------- |
| `value`       | `string`                               | -                           | The current value of the editor              |
| `onChange`    | `(value: string \| undefined) => void` | -                           | Callback when editor content changes         |
| `language`    | `string`                               | `'typescript'`              | Programming language for syntax highlighting |
| `height`      | `string`                               | `'400px'`                   | Height of the editor                         |
| `placeholder` | `string`                               | `'Enter your code here...'` | Placeholder text when editor is empty        |
| `readOnly`    | `boolean`                              | `false`                     | Whether the editor is read-only              |

## Key Features Implementation

### Axios Type Injection

The component automatically injects comprehensive axios type definitions:

```typescript
// These types are automatically available:
axios.get<UserData>("/api/users");
axios.post("/api/users", userData);
axios.isAxiosError(error);
```

### Cmd+S Formatting

The editor overrides the default save behavior:

```typescript
// Automatically bound to Cmd+S / Ctrl+S
editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
  formatCode();
});
```

### Enhanced Options

The editor includes optimized settings for the best development experience:

- Enhanced suggestion settings
- Improved scrolling and navigation
- Better bracket pair colorization
- Optimized for dark/light themes

## Browser Compatibility

- Chrome/Chromium-based browsers
- Firefox
- Safari
- Edge

## Dependencies

- `@monaco-editor/react`
- `next-themes` (for theme support)
- React 18+

## Notes

- The editor automatically adapts to your theme (dark/light mode)
- Type definitions are injected on editor mount
- Formatting uses Monaco's built-in TypeScript formatter
- Global types are cached for performance
