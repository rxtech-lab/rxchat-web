# Enhanced Prompt Dialog System

The prompt dialog system allows users to create, manage, and use prompt templates with TypeScript code using Monaco Editor.

## Features

### 🎯 Template Selection

- Browse and select from existing prompt templates
- Real-time search and filtering
- Visual preview with descriptions

### ✨ CRUD Operations

- **Create**: New prompts with title, description, and TypeScript code
- **Read**: View all your prompts in an organized list
- **Update**: Edit existing prompts with live preview
- **Delete**: Remove unwanted prompts with confirmation

### 🎨 Modern UI

- Monaco Editor with TypeScript support
- Real-time syntax highlighting
- Responsive design with Tailwind CSS
- Toast notifications using Sonner
- Loading states and error handling

### 🔧 Technical Features

- Promise-based toast notifications
- Client-side state management
- Type-safe API endpoints
- Database integration with Drizzle ORM
- Authentication and user ownership

## Components

### `PromptDialog`

Main dialog component that orchestrates the entire prompt management system.

```tsx
<PromptDialog
  currentPrompt={selectedPrompt}
  onSelectPrompt={(prompt) => {
    // Handle prompt selection
    setSelectedPrompt(prompt);
    setInput(prompt.code); // Apply to input
  }}
/>
```

### `PromptList`

Displays all prompts in a scrollable list with actions.

### `PromptForm`

Form component for creating and editing prompts with Monaco Editor.

### `MonacoEditor`

Wrapper around Monaco Editor configured for TypeScript.

## API Endpoints

- `GET /api/prompts` - Fetch user's prompts
- `POST /api/prompts` - Create new prompt
- `PATCH /api/prompts` - Update existing prompt
- `DELETE /api/prompts?id=<id>` - Delete prompt

## Database Schema

```sql
CREATE TABLE "Prompt" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "description" text,
  "code" text NOT NULL,
  "authorId" uuid NOT NULL REFERENCES "User"("id"),
  "visibility" varchar DEFAULT 'private',
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);
```

## Toast Notifications

The system uses Sonner's promise-based toasts for all operations:

```tsx
toast.promise(createPrompt(data), {
  loading: "Creating prompt...",
  success: (prompt) => `${prompt.title} has been created`,
  error: (error) => error.message || "Failed to create prompt",
});
```

## Usage Example

```tsx
import { PromptDialog } from "./prompt-dialog";
import { useState } from "react";
import type { Prompt } from "@/lib/db/schema";

function MyComponent() {
  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null);

  return (
    <PromptDialog
      currentPrompt={currentPrompt || undefined}
      onSelectPrompt={(prompt) => {
        setCurrentPrompt(prompt);
        // Apply the prompt code to your input or execute it
        console.log("Selected prompt:", prompt.title);
        console.log("Code:", prompt.code);
      }}
    />
  );
}
```

## Styling

All components use Tailwind CSS classes and are designed to work with both light and dark themes. The Monaco Editor automatically adapts to the current theme.

## Error Handling

- Network errors show user-friendly messages
- Validation errors for required fields
- Database errors are handled gracefully
- Loading states prevent multiple submissions

## Security

- User authentication required
- Prompts are user-scoped (users can only see their own)
- Server-side validation for all operations
- SQL injection protection via Drizzle ORM
