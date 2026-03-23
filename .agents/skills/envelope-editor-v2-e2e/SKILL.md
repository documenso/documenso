---
name: envelope-editor-v2-e2e
description: Writing and maintaining Playwright E2E tests for the Envelope Editor V2. Use when the user needs to create, modify, debug, or extend E2E tests in packages/app-tests/e2e/envelope-editor-v2/. Triggers include requests to "write an e2e test", "add a test for the envelope editor", "test envelope settings/recipients/fields/items/attachments", "fix a failing envelope test", or any task involving Playwright tests for the envelope editor feature.
---

# Envelope Editor V2 E2E Tests

## Overview

The Envelope Editor V2 E2E test suite lives in `packages/app-tests/e2e/envelope-editor-v2/`. Each test file covers a distinct feature area of the envelope editor and follows a strict architectural pattern that tests the **same flow** across four surfaces:

1. **Document** (`documents/<id>`) - Native document editor
2. **Template** (`templates/<id>`) - Native template editor
3. **Embedded Create** (`/embed/v2/authoring/envelope/create`) - Embedded editor creating a new envelope
4. **Embedded Edit** (`/embed/v2/authoring/envelope/edit/<id>`) - Embedded editor updating an existing envelope

## Project Structure

```
packages/app-tests/
  e2e/
    envelope-editor-v2/
      envelope-attachments.spec.ts   # Attachment CRUD
      envelope-fields.spec.ts        # Field placement on PDF canvas
      envelope-items.spec.ts         # PDF document item CRUD
      envelope-recipients.spec.ts    # Recipient management
      envelope-settings.spec.ts      # Settings dialog
    fixtures/
      authentication.ts              # apiSignin, apiSignout
      documents.ts                   # Document tab helpers
      envelope-editor.ts             # Core fixture: surface openers + locator/action helpers
      generic.ts                     # Toast assertions, text visibility
      signature.ts                   # Signature pad helpers
  playwright.config.ts               # Test configuration
```

## Core Abstraction: `TEnvelopeEditorSurface`

Every test revolves around the `TEnvelopeEditorSurface` type from `fixtures/envelope-editor.ts`. This is the central abstraction that normalizes differences between the four surfaces:

```typescript
type TEnvelopeEditorSurface = {
  root: Page; // The Playwright page
  isEmbedded: boolean; // true for embed surfaces
  envelopeId?: string; // Set for document/template/embed-edit, undefined for embed-create
  envelopeType: 'DOCUMENT' | 'TEMPLATE';
  userId: number; // Seeded user ID
  userEmail: string; // Seeded user email
  userName: string; // Seeded user name
  teamId: number; // Seeded team ID
};
```

### Surface Openers (from `fixtures/envelope-editor.ts`)

```typescript
// Native surfaces - seed user + document/template, sign in, navigate
const surface = await openDocumentEnvelopeEditor(page);
const surface = await openTemplateEnvelopeEditor(page);

// Embedded surfaces - seed user, create API token, get presign token, navigate
const surface = await openEmbeddedEnvelopeEditor(page, {
  envelopeType: 'DOCUMENT' | 'TEMPLATE',
  mode?: 'create' | 'edit',         // default: 'create'
  tokenNamePrefix?: string,          // for unique API token names
  externalId?: string,               // optional external ID in hash
  features?: EmbeddedEditorConfig,   // feature flags
});
```

## Test Architecture Pattern

Every test file follows this structure, with four `test.describe` blocks grouping tests by editor surface:

### 1. Imports

```typescript
import { type Page, expect, test } from '@playwright/test';
// Prisma enums if needed for DB assertions
import { SomePrismaEnum } from '@prisma/client';

import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import {
  type TEnvelopeEditorSurface, // Import needed helpers from the fixture
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
  persistEmbeddedEnvelope, // ... other helpers
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';
```

### 2. Type definitions and constants

```typescript
type FlowResult = {
  externalId: string;
  // ... other data needed for DB assertions
};

const TEST_VALUES = {
  // Centralized test data constants
};
```

### 3. Local helper functions

```typescript
// Common: open settings and set external ID for DB lookup
const openSettingsDialog = async (root: Page) => {
  await getEnvelopeEditorSettingsTrigger(root).click();
  await expect(root.getByRole('heading', { name: 'Document Settings' })).toBeVisible();
};

const updateExternalId = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  await openSettingsDialog(surface.root);
  await surface.root.locator('input[name="externalId"]').fill(externalId);
  await surface.root.getByRole('button', { name: 'Update' }).click();

  if (!surface.isEmbedded) {
    await expectToastTextToBeVisible(surface.root, 'Envelope updated');
  }
};
```

### 4. The flow function

A single `runXxxFlow` function that works across ALL surfaces. It handles embedded vs non-embedded differences internally:

```typescript
const runMyFeatureFlow = async (surface: TEnvelopeEditorSurface): Promise<FlowResult> => {
  const externalId = `e2e-feature-${nanoid()}`;

  // For embedded create, may need to add a PDF first
  if (surface.isEmbedded && !surface.envelopeId) {
    await addEnvelopeItemPdf(surface.root, 'embedded-feature.pdf');
  }

  await updateExternalId(surface, externalId);

  // Handle embedded vs native differences
  if (surface.isEmbedded) {
    // No "Add Myself" button in embedded mode
    await setRecipientEmail(surface.root, 0, 'embedded@example.com');
  } else {
    await clickAddMyselfButton(surface.root);
  }

  // ... perform feature-specific actions ...

  // Navigate away and back to verify UI persistence
  await clickEnvelopeEditorStep(surface.root, 'addFields');
  await clickEnvelopeEditorStep(surface.root, 'upload');

  // ... assert UI state after navigation ...

  return { externalId /* ... */ };
};
```

### 5. Database assertion function

Uses Prisma directly to verify data was persisted correctly:

```typescript
const assertFeaturePersistedInDatabase = async ({
  surface,
  externalId,
  // ... expected values
}: {
  surface: TEnvelopeEditorSurface;
  externalId: string;
  // ...
}) => {
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      externalId,
      userId: surface.userId,
      teamId: surface.teamId,
      type: surface.envelopeType,
    },
    include: {
      // Include related data as needed
      documentMeta: true,
      recipients: true,
      fields: true,
      envelopeAttachments: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Assert expected values
  expect(envelope.someField).toBe(expectedValue);
};
```

### 6. The four `test.describe` blocks

Tests are organized into four `test.describe` blocks, one per editor surface. Each describe block contains the tests relevant to that surface. This structure allows adding multiple tests per surface while keeping them grouped:

```typescript
test.describe('document editor', () => {
  test('description of what is tested', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runMyFeatureFlow(surface);

    await assertFeaturePersistedInDatabase({
      surface,
      ...result,
    });
  });

  // Additional document-editor-specific tests here...
});

test.describe('template editor', () => {
  test('description of what is tested', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runMyFeatureFlow(surface);

    await assertFeaturePersistedInDatabase({
      surface,
      ...result,
    });
  });

  // Additional template-editor-specific tests here...
});

test.describe('embedded create', () => {
  test('description of what is tested', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-feature',
    });

    const result = await runMyFeatureFlow(surface);

    // IMPORTANT: Must persist before DB assertions for embedded
    await persistEmbeddedEnvelope(surface);

    await assertFeaturePersistedInDatabase({
      surface,
      ...result,
    });
  });

  // Additional embedded-create-specific tests here...
});

test.describe('embedded edit', () => {
  test('description of what is tested', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-feature',
    });

    const result = await runMyFeatureFlow(surface);

    // IMPORTANT: Must persist before DB assertions for embedded
    await persistEmbeddedEnvelope(surface);

    await assertFeaturePersistedInDatabase({
      surface,
      ...result,
    });
  });

  // Additional embedded-edit-specific tests here...
});
```

When a test only applies to specific surfaces (e.g., a document-only action like "send document"), only include it in the relevant describe block(s). Not every describe block needs the same tests -- the structure groups tests by surface, not by requiring symmetry.

## Key Differences Between Surfaces

| Behavior                   | Document/Template          | Embedded Create                           | Embedded Edit                             |
| -------------------------- | -------------------------- | ----------------------------------------- | ----------------------------------------- |
| User seeding               | Seed + sign in             | Seed + API token                          | Seed + API token + seed envelope          |
| "Add Myself" button        | Available                  | Not available                             | Not available                             |
| Toast on settings update   | Yes (`'Envelope updated'`) | No                                        | No                                        |
| PDF already attached       | Yes (1 item)               | No (0 items, must upload)                 | Yes (1 item)                              |
| Delete confirmation dialog | Yes (`'Delete'` button)    | No (immediate)                            | No (immediate)                            |
| DB persistence timing      | Immediate (autosaved)      | After `persistEmbeddedEnvelope()`         | After `persistEmbeddedEnvelope()`         |
| Persist button label       | N/A                        | `'Create Document'` / `'Create Template'` | `'Update Document'` / `'Update Template'` |

## Available Fixture Helpers

### From `fixtures/envelope-editor.ts`

**Locator helpers** (return Playwright Locators):

- `getEnvelopeEditorSettingsTrigger(root)` - Settings gear button
- `getEnvelopeItemTitleInputs(root)` - Title inputs for envelope items
- `getEnvelopeItemDragHandles(root)` - Drag handles for reordering items
- `getEnvelopeItemRemoveButtons(root)` - Remove buttons for items
- `getEnvelopeItemDropzoneInput(root)` - File input for PDF upload
- `getRecipientEmailInputs(root)` - Email inputs for recipients
- `getRecipientNameInputs(root)` - Name inputs for recipients
- `getRecipientRows(root)` - Full recipient row fieldsets
- `getRecipientRemoveButtons(root)` - Remove buttons for recipients
- `getSigningOrderInputs(root)` - Signing order number inputs

**Action helpers**:

- `addEnvelopeItemPdf(root, fileName?)` - Upload a PDF to the dropzone
- `clickEnvelopeEditorStep(root, stepId)` - Navigate to a step: `'upload'`, `'addFields'`, `'preview'`
- `clickAddMyselfButton(root)` - Click "Add Myself" (native only)
- `clickAddSignerButton(root)` - Click "Add Signer"
- `setRecipientEmail(root, index, email)` - Fill recipient email
- `setRecipientName(root, index, name)` - Fill recipient name
- `setRecipientRole(root, index, roleLabel)` - Set role via combobox
- `assertRecipientRole(root, index, roleLabel)` - Assert role value
- `toggleSigningOrder(root, enabled)` - Toggle signing order switch
- `toggleAllowDictateSigners(root, enabled)` - Toggle dictate signers switch
- `setSigningOrderValue(root, index, value)` - Set signing order number
- `persistEmbeddedEnvelope(surface)` - Click Create/Update button for embedded flows

### From `fixtures/generic.ts`

- `expectTextToBeVisible(page, text)` - Assert text visible on page
- `expectTextToNotBeVisible(page, text)` - Assert text not visible
- `expectToastTextToBeVisible(page, text)` - Assert toast message visible

## External ID Pattern

Every test uses an `externalId` (e.g., `e2e-feature-${nanoid()}`) set via the settings dialog. This unique ID is then used in Prisma queries to reliably locate the envelope in the database for assertions. This is critical because multiple tests run in parallel.

## Running Tests

```bash
# Run all envelope editor tests
npm run test:dev -w @documenso/app-tests -- --grep "Envelope Editor V2"

# Run a specific test file
npm run test:dev -w @documenso/app-tests -- e2e/envelope-editor-v2/envelope-recipients.spec.ts

# Run with UI
npm run test-ui:dev -w @documenso/app-tests -- e2e/envelope-editor-v2/

# Run specific test by name
npm run test:dev -w @documenso/app-tests -- --grep "documents/<id>: add myself"
```

## Checklist When Writing a New Test

1. Create the spec file in `packages/app-tests/e2e/envelope-editor-v2/`
2. Import `TEnvelopeEditorSurface` and the three opener functions
3. Import `persistEmbeddedEnvelope` if you need DB assertions for embedded flows
4. Define a `FlowResult` type for data passed between flow and assertion
5. Define `TEST_VALUES` constants for test data
6. Write `updateExternalId` helper (or reuse the pattern)
7. Write the `runXxxFlow` function handling embedded vs native differences
8. Write the `assertXxxPersistedInDatabase` function using Prisma
9. Create four `test.describe` blocks: `'document editor'`, `'template editor'`, `'embedded create'`, `'embedded edit'`
10. Place tests inside the appropriate describe block for each surface
11. For embedded create tests, add a PDF via `addEnvelopeItemPdf` before the flow
12. For embedded tests, call `persistEmbeddedEnvelope(surface)` before DB assertions
13. Use `surface.isEmbedded` to branch on behavioral differences (toasts, "Add Myself", etc.)

## Common Pitfalls

- **Missing `persistEmbeddedEnvelope`**: Embedded flows don't autosave. You MUST call this before any DB assertions.
- **PDF required for embedded create**: Embedded create starts with 0 items. Upload a PDF before navigating to fields.
- **Toast assertions in embedded**: Don't assert toasts for settings updates in embedded mode (they don't appear).
- **Parallel test isolation**: Always use a unique `externalId` via `nanoid()` so parallel tests don't collide.
- **Navigation verification**: Navigate away from and back to the current step to verify UI state persistence (the editor may re-render).
- **Delete confirmation**: Native surfaces show a confirmation dialog for item deletion; embedded surfaces delete immediately.
