# Documenso Code Style Guide

This document captures the code style, patterns, and conventions used in the Documenso codebase. It covers both enforceable rules and subjective "taste" elements that make our code consistent and maintainable.

## Table of Contents

1. [General Principles](#general-principles)
2. [TypeScript Conventions](#typescript-conventions)
3. [Imports & Dependencies](#imports--dependencies)
4. [Functions & Methods](#functions--methods)
5. [React & Components](#react--components)
6. [Error Handling](#error-handling)
7. [Async/Await Patterns](#asyncawait-patterns)
8. [Whitespace & Formatting](#whitespace--formatting)
9. [Naming Conventions](#naming-conventions)
10. [Pattern Matching](#pattern-matching)
11. [Database & Prisma](#database--prisma)
12. [TRPC Patterns](#trpc-patterns)

---

## General Principles

- **Functional over Object-Oriented**: Prefer functional programming patterns over classes
- **Explicit over Implicit**: Be explicit about types, return values, and error cases
- **Early Returns**: Use guard clauses and early returns to reduce nesting
- **Immutability**: Favor `const` over `let`; avoid mutation where possible

---

## TypeScript Conventions

### Type Definitions

```typescript
// ✅ Prefer `type` over `interface`
type CreateDocumentOptions = {
  templateId: number;
  userId: number;
  recipients: Recipient[];
};

// ❌ Avoid interfaces unless absolutely necessary
interface CreateDocumentOptions {
  templateId: number;
}
```

### Type Imports

```typescript
// ✅ Use `type` keyword for type-only imports
import type { Document, Recipient } from '@prisma/client';
import { DocumentStatus } from '@prisma/client';

// Types in function signatures
export const findDocuments = async ({ userId, teamId }: FindDocumentsOptions) => {
  // ...
};
```

### Inline Types for Function Parameters

```typescript
// ✅ Extract inline types to named types
type FinalRecipient = Pick<Recipient, 'name' | 'email' | 'role' | 'authOptions'> & {
  templateRecipientId: number;
  fields: Field[];
};

const finalRecipients: FinalRecipient[] = [];
```

---

## Imports & Dependencies

### Import Organization

Imports should be organized in the following order with blank lines between groups:

```typescript
// 1. React imports
import { useCallback, useEffect, useMemo } from 'react';

// 2. Third-party library imports (alphabetically)
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import type { Document, Recipient } from '@prisma/client';
import { DocumentStatus, RecipientRole } from '@prisma/client';
import { match } from 'ts-pattern';

// 3. Internal package imports (from @documenso/*)
import { AppError } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { Button } from '@documenso/ui/primitives/button';

// 4. Relative imports
import { getTeamById } from '../team/get-team';
import type { FindResultResponse } from './types';
```

### Destructuring Imports

```typescript
// ✅ Destructure specific exports
// ✅ Use type imports for types
import type { Document } from '@prisma/client';

import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
```

---

## Functions & Methods

### Arrow Functions

```typescript
// ✅ Always use arrow functions for functions
export const createDocument = async ({
  userId,
  title,
}: CreateDocumentOptions) => {
  // ...
};

// ✅ Callbacks and handlers
const onSubmit = useCallback(async () => {
  // ...
}, [dependencies]);

// ❌ Avoid regular function declarations
function createDocument() {
  // ...
}
```

### Function Parameters

```typescript
// ✅ Use destructured object parameters for multiple params
export const findDocuments = async ({
  userId,
  teamId,
  status = ExtendedDocumentStatus.ALL,
  page = 1,
  perPage = 10,
}: FindDocumentsOptions) => {
  // ...
};

// ✅ Destructure on separate line when needed
const onFormSubmit = form.handleSubmit(onSubmit);

// ✅ Deconstruct nested properties explicitly
const { user } = ctx;
const { templateId } = input;
```

---

## React & Components

### Component Definition

```typescript
// ✅ Use const with arrow function
export const AddSignersFormPartial = ({
  documentFlow,
  recipients,
  fields,
  onSubmit,
}: AddSignersFormProps) => {
  // ...
};

// ❌ Never use classes
class MyComponent extends React.Component {
  // ...
}
```

### Hooks

```typescript
// ✅ Group related hooks together with blank line separation
const { _ } = useLingui();
const { toast } = useToast();

const { currentStep, totalSteps, previousStep } = useStep();

const form = useForm<TFormSchema>({
  resolver: zodResolver(ZFormSchema),
  defaultValues: {
    // ...
  },
});
```

### Event Handlers

```typescript
// ✅ Use arrow functions with descriptive names
const onFormSubmit = async () => {
  await form.trigger();
  // ...
};

const onFieldCopy = useCallback(
  (event?: KeyboardEvent | null) => {
    event?.preventDefault();
    // ...
  },
  [dependencies],
);

// ✅ Inline handlers for simple operations
<Button onClick={() => setOpen(false)}>Close</Button>
```

### State Management

```typescript
// ✅ Descriptive state names with auxiliary verbs
const [isLoading, setIsLoading] = useState(false);
const [hasError, setHasError] = useState(false);
const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

// ✅ Complex state in single useState when related
const [coords, setCoords] = useState({
  x: 0,
  y: 0,
});
```

---

## Error Handling

### Try-Catch Blocks

```typescript
// ✅ Use try-catch for operations that might fail
try {
  const document = await getDocumentById({
    documentId: Number(documentId),
    userId: user.id,
  });

  return {
    status: 200,
    body: document,
  };
} catch (err) {
  return {
    status: 404,
    body: {
      message: 'Document not found',
    },
  };
}
```

### Throwing Errors

```typescript
// ✅ Use AppError for application errors
throw new AppError(AppErrorCode.NOT_FOUND, {
  message: 'Template not found',
});

// ✅ Use descriptive error messages
if (!template) {
  throw new AppError(AppErrorCode.NOT_FOUND, {
    message: `Template with ID ${templateId} not found`,
  });
}
```

### Error Parsing on Frontend

```typescript
// ✅ Parse errors on the frontend
try {
  await updateOrganisation({ organisationId, data });
} catch (err) {
  const error = AppError.parseError(err);
  console.error(error);

  toast({
    title: t`An error occurred`,
    description: error.message,
    variant: 'destructive',
  });
}
```

---

## Async/Await Patterns

### Async Function Definitions

```typescript
// ✅ Mark async functions clearly
export const createDocument = async ({
  userId,
  title,
}: Options): Promise<Document> => {
  // ...
};

// ✅ Use await for promises
const document = await prisma.document.create({ data });

// ✅ Use Promise.all for parallel operations
const [document, recipients] = await Promise.all([
  getDocumentById({ documentId }),
  getRecipientsForDocument({ documentId }),
]);
```

### Void for Fire-and-Forget

```typescript
// ✅ Use void for intentionally unwaited promises
void handleAutoSave();

// ✅ Or in event handlers
onClick={() => void onFormSubmit()}
```

---

## Whitespace & Formatting

### Blank Lines Between Concepts

```typescript
// ✅ Blank line after imports
import { prisma } from '@documenso/prisma';

export const findDocuments = async () => {
  // ...
};

// ✅ Blank line between logical sections
const user = await prisma.user.findFirst({ where: { id: userId } });

let team = null;

if (teamId !== undefined) {
  team = await getTeamById({ userId, teamId });
}

// ✅ Blank line before return statements
const result = await someOperation();

return result;
```

### Function/Method Spacing

```typescript
// ✅ No blank lines between chained methods in same operation
const documents = await prisma.document
  .findMany({ where: { userId } })
  .then((docs) => docs.map(maskTokens));

// ✅ Blank line between different operations
const document = await createDocument({ userId });

await sendDocument({ documentId: document.id });

return document;
```

### Object and Array Formatting

```typescript
// ✅ Multi-line when complex
const options = {
  userId,
  teamId,
  status: ExtendedDocumentStatus.ALL,
  page: 1,
};

// ✅ Single line when simple
const coords = { x: 0, y: 0 };

// ✅ Array items on separate lines when objects
const recipients = [
  {
    name: 'John',
    email: 'john@example.com',
  },
  {
    name: 'Jane',
    email: 'jane@example.com',
  },
];
```

---

## Naming Conventions

### Variables

```typescript
// ✅ camelCase for variables and functions
const documentId = 123;
const onSubmit = () => {};

// ✅ Descriptive names with auxiliary verbs for booleans
const isLoading = false;
const hasError = false;
const canEdit = true;
const shouldRender = true;

// ✅ Prefix with $ for DOM elements
const $page = document.querySelector('.page');
const $inputRef = useRef<HTMLInputElement>(null);
```

### Types and Schemas

```typescript
// ✅ PascalCase for types
type CreateDocumentOptions = {
  userId: number;
};

// ✅ Prefix Zod schemas with Z
const ZCreateDocumentSchema = z.object({
  title: z.string(),
});

// ✅ Prefix type from Zod schema with T
type TCreateDocumentSchema = z.infer<typeof ZCreateDocumentSchema>;
```

### Constants

```typescript
// ✅ UPPER_SNAKE_CASE for true constants
const DEFAULT_DOCUMENT_DATE_FORMAT = 'dd/MM/yyyy';
const MAX_FILE_SIZE = 1024 * 1024 * 5;

// ✅ camelCase for const variables that aren't "constants"
const userId = await getUserId();
```

### Functions

```typescript
// ✅ Verb-based names for functions
const createDocument = async () => {};
const findDocuments = async () => {};
const updateDocument = async () => {};
const deleteDocument = async () => {};

// ✅ On prefix for event handlers
const onSubmit = () => {};
const onClick = () => {};
const onFieldCopy = () => {}; // 'on' is also acceptable
```

### Clarity Over Brevity

```typescript
// ✅ Prefer descriptive names over abbreviations
const superLongMethodThatIsCorrect = () => {};
const recipientAuthenticationOptions = {};
const documentMetadata = {};

// ❌ Avoid abbreviations that sacrifice clarity
const supLongMethThatIsCorrect = () => {};
const recipAuthOpts = {};
const docMeta = {};

// ✅ Common abbreviations that are widely understood are acceptable
const userId = 123;
const htmlElement = document.querySelector('div');
const apiResponse = await fetch('/api');
```

---

## Pattern Matching

### Using ts-pattern

```typescript
import { match } from 'ts-pattern';

// ✅ Use match for complex conditionals
const result = match(status)
  .with(ExtendedDocumentStatus.DRAFT, () => ({
    status: 'draft',
  }))
  .with(ExtendedDocumentStatus.PENDING, () => ({
    status: 'pending',
  }))
  .with(ExtendedDocumentStatus.COMPLETED, () => ({
    status: 'completed',
  }))
  .exhaustive();

// ✅ Use .otherwise() for default case when not exhaustive
const value = match(type)
  .with('text', () => 'Text field')
  .with('number', () => 'Number field')
  .otherwise(() => 'Unknown field');
```

---

## Database & Prisma

### Query Structure

```typescript
// ✅ Destructure commonly used fields
const { id, email, name } = user;

// ✅ Use select to limit returned fields
const user = await prisma.user.findFirst({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    name: true,
  },
});

// ✅ Use include for relations
const document = await prisma.document.findFirst({
  where: { id: documentId },
  include: {
    recipients: true,
    fields: true,
  },
});
```

### Transactions

```typescript
// ✅ Use transactions for related operations
return await prisma.$transaction(async (tx) => {
  const document = await tx.document.create({ data });

  await tx.field.createMany({ data: fieldsData });

  await tx.documentAuditLog.create({ data: auditData });

  return document;
});
```

### Where Clauses

```typescript
// ✅ Build complex where clauses separately
const whereClause: Prisma.DocumentWhereInput = {
  AND: [
    { userId: user.id },
    { deletedAt: null },
    { status: { in: [DocumentStatus.DRAFT, DocumentStatus.PENDING] } },
  ],
};

const documents = await prisma.document.findMany({
  where: whereClause,
});
```

---

## TRPC Patterns

### Router Structure

```typescript
// ✅ Destructure context and input at start
.query(async ({ input, ctx }) => {
  const { teamId } = ctx;
  const { templateId } = input;

  ctx.logger.info({
    input: { templateId },
  });

  return await getTemplateById({
    id: templateId,
    userId: ctx.user.id,
    teamId,
  });
});
```

### Request/Response Schemas

```typescript
// ✅ Name schemas clearly
const ZCreateDocumentRequestSchema = z.object({
  title: z.string(),
  recipients: z.array(ZRecipientSchema),
});

const ZCreateDocumentResponseSchema = z.object({
  documentId: z.number(),
  status: z.string(),
});
```

### Error Handling in TRPC

```typescript
// ✅ Catch and transform errors appropriately
try {
  const result = await createDocument({ userId, data });

  return result;
} catch (err) {
  return AppError.toRestAPIError(err);
}

// ✅ Or throw AppError directly
if (!template) {
  throw new AppError(AppErrorCode.NOT_FOUND, {
    message: 'Template not found',
  });
}
```

---

## Additional Patterns

### Optional Chaining

```typescript
// ✅ Use optional chaining for potentially undefined values
const email = user?.email;
const recipientToken = recipient?.token ?? '';

// ✅ Use nullish coalescing for defaults
const pageSize = perPage ?? 10;
const status = documentStatus ?? DocumentStatus.DRAFT;
```

### Array Operations

```typescript
// ✅ Use functional array methods
const activeRecipients = recipients.filter((r) => r.signingStatus === 'SIGNED');
const recipientEmails = recipients.map((r) => r.email);
const hasSignedRecipients = recipients.some((r) => r.signingStatus === 'SIGNED');

// ✅ Use find instead of filter + [0]
const recipient = recipients.find((r) => r.id === recipientId);
```

### Conditional Rendering

```typescript
// ✅ Use && for conditional rendering
{isLoading && <Loader />}

// ✅ Use ternary for either/or
{isLoading ? <Loader /> : <Content />}

// ✅ Extract complex conditions to variables
const shouldShowAdvanced = isAdmin && hasPermission && !isDisabled;
{shouldShowAdvanced && <AdvancedSettings />}
```

---

## When in Doubt

- **Consistency**: Follow the patterns you see in similar files
- **Readability**: Favor code that's easy to read over clever one-liners
- **Explicitness**: Be explicit rather than implicit
- **Whitespace**: Use blank lines to separate logical sections
- **Early Returns**: Use guard clauses to reduce nesting
- **Functional**: Prefer functional patterns over imperative ones
