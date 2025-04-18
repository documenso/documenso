---
description: Guidelines for working with Gmail API
globs: 
alwaysApply: false
---
# Gmail API Usage

Guidelines for working with email provider APIs (Gmail, Outlook, etc.) to ensure maintainability and future provider support.
Currently we only support Gmail.

## Core Principles

1. **Never call provider APIs directly from routes or components**
2. **Always use wrapper functions from the utils folder**
3. **Keep provider-specific implementation details isolated**

## Directory Structure

```
apps/web/utils/
├── gmail/           # Gmail-specific implementations
│   ├── message.ts   # Message operations (get, list, batch, etc.)
│   ├── thread.ts    # Thread operations
│   ├── label.ts     # Label operations
│   └── ...
├── outlook/         # Future Outlook implementation
└── ...              # Other providers
```

## Usage Patterns

### ✅ DO: Use the abstraction layers

```typescript
// GOOD: Using provided utility functions
import { getMessages, getMessage } from "@/utils/gmail/message";

async function fetchEmails(gmail: gmail_v1.Gmail, query: string) {
  // Use the wrapper function that handles implementation details
  const messages = await getMessages(gmail, {
    query,
    maxResults: 10,
  });

  return messages;
}
```

### ❌ DON'T: Call provider APIs directly

```typescript
// BAD: Direct API calls
async function fetchEmails(gmail: gmail_v1.Gmail, query: string) {
  // Direct API calls make future provider support difficult
  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 10,
  });

  return response.data;
}
```

## Why This Matters

1. **Future Provider Support**: By isolating provider-specific implementations, we can add support for Outlook, ProtonMail, etc.
