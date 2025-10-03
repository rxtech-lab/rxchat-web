# i18n Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Request                            │
│                    (e.g., /zh-CN/login)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Middleware                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  1. next-intl routing (locale detection)             │   │
│  │  2. Authentication checks (locale-aware redirects)   │   │
│  │  3. API route exceptions                             │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Root Layout                                 │
│                  (app/layout.tsx)                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  - Validates locale parameter                        │   │
│  │  - Generates static params for all locales          │   │
│  │  - Renders children                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               Locale Layout                                  │
│            (app/[locale]/layout.tsx)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  - NextIntlClientProvider wraps app                  │   │
│  │  - Loads messages for current locale                 │   │
│  │  - Sets HTML lang attribute                          │   │
│  │  - Provides translations to all child components     │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Page Components                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Client Components:                                  │   │
│  │  - useTranslations('namespace')                      │   │
│  │  - Access translations with t('key')                 │   │
│  │                                                       │   │
│  │  Server Components:                                  │   │
│  │  - await getTranslations('namespace')                │   │
│  │  - Access translations with t('key')                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Translation Loading Flow

```
User navigates to /zh-CN/login
            │
            ▼
    Middleware processes request
            │
            ├─> Detects locale: zh-CN
            ├─> Checks authentication
            └─> Forwards to app
            │
            ▼
    lib/i18n/request.ts
            │
            ├─> Validates locale
            └─> Imports locales/zh-CN/common.json
            │
            ▼
    Messages passed to NextIntlClientProvider
            │
            ▼
    Component calls useTranslations('auth')
            │
            ▼
    Returns translated strings
```

## Directory Structure

```
rxchat-web/
│
├── app/
│   ├── layout.tsx                  # Root layout (validates locale)
│   └── [locale]/                   # Locale segment
│       ├── layout.tsx              # Provides i18n context
│       ├── (auth)/                 # Auth pages (login, register)
│       └── (chat)/                 # Chat pages
│
├── lib/
│   └── i18n/
│       ├── config.ts               # Locale definitions & names
│       ├── request.ts              # next-intl configuration
│       └── routing.ts              # Navigation helpers
│
├── locales/
│   ├── en/
│   │   └── common.json            # English translations
│   ├── zh-CN/
│   │   └── common.json            # Simplified Chinese
│   └── zh-TW/
│       └── common.json            # Traditional Chinese
│
├── components/
│   └── language-selector.tsx      # Language switcher UI
│
├── middleware.ts                   # Handles routing & locale
└── next.config.ts                  # next-intl plugin config
```

## Component Integration Patterns

### Client Component Pattern

```tsx
'use client';
import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('namespace');
  
  return <div>{t('key')}</div>;
}
```

### Server Component Pattern

```tsx
import { getTranslations } from 'next-intl/server';

export default async function MyPage() {
  const t = await getTranslations('namespace');
  
  return <div>{t('key')}</div>;
}
```

### Navigation Pattern

```tsx
import { Link, useRouter } from '@/lib/i18n/routing';

// Link with automatic locale
<Link href="/profile">Profile</Link>

// Programmatic navigation
const router = useRouter();
router.push('/profile'); // Maintains current locale
```

## Translation File Structure

```json
{
  "namespace": {
    "key": "Translation value",
    "nested": {
      "key": "Nested value"
    }
  }
}
```

Example:
```json
{
  "greeting": {
    "hello": "Hello there!",
    "help": "How can I help you today?"
  },
  "auth": {
    "signIn": "Sign In",
    "signUp": "Sign up"
  }
}
```

## Language Selector Component

```
┌──────────────────────────────┐
│  User Menu (Sidebar)         │
│  ┌────────────────────────┐  │
│  │  Language Selector     │  │
│  │  ┌──────────────────┐  │  │
│  │  │  🌐 简体中文    │  │  │
│  │  │  ├─ English     │  │  │
│  │  │  ├─ 简体中文    │  │  │
│  │  │  └─ 繁體中文    │  │  │
│  │  └──────────────────┘  │  │
│  │  Theme Toggle          │  │
│  │  Jobs                  │  │
│  │  Manage Account        │  │
│  │  Sign out              │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

## Locale URL Examples

| Page | English | Chinese Simplified | Chinese Traditional |
|------|---------|-------------------|---------------------|
| Home | `/en` | `/zh-CN` | `/zh-TW` |
| Login | `/en/login` | `/zh-CN/login` | `/zh-TW/login` |
| Chat | `/en/chat/123` | `/zh-CN/chat/123` | `/zh-TW/chat/123` |
| Profile | `/en/profile` | `/zh-CN/profile` | `/zh-TW/profile` |

## Key Design Decisions

1. **Locale in URL**: Makes sharing links with specific language easy
2. **Middleware First**: Ensures locale is set before any other logic
3. **Consistent Structure**: All locales have identical JSON structure
4. **Client & Server**: Both rendering modes supported
5. **Type Safety**: TypeScript ensures translation keys exist
6. **Namespacing**: Organized translations by feature area
7. **Lazy Loading**: Only loads translations for current locale

## Benefits

✅ SEO-friendly URLs with locale prefix
✅ Easy language switching without page reload
✅ Type-safe translations
✅ Server and client component support
✅ Consistent user experience across locales
✅ Easy to add new languages
✅ Maintains locale across navigation
