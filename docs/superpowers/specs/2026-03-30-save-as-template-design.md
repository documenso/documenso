# Save Document as Template

## Summary

Allow users to create a template from an existing V2 document. The feature extends the existing `duplicateEnvelope` function with a `duplicateAsTemplate` flag and adds a new `envelope.saveAsTemplate` tRPC route. A dialog lets users choose whether to include recipients and fields.

## Constraints

- V2 envelopes only (hidden for V1)
- Documents only -- TEMPLATE to DOCUMENT conversion is not allowed
- Available for all document statuses (Draft, Pending, Completed, Rejected)
- The created template is always a new Draft envelope of type TEMPLATE

## Backend

### `duplicateEnvelope` changes

**File**: `packages/lib/server-only/envelope/duplicate-envelope.ts`

Extend the options interface:

```typescript
export interface DuplicateEnvelopeOptions {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
  overrides?: {
    duplicateAsTemplate?: boolean;
    includeRecipients?: boolean; // default: true
    includeFields?: boolean; // default: true
  };
}
```

Behavioral changes when `duplicateAsTemplate` is `true`:

1. **Validation**: Throw `AppError` if source envelope `type !== DOCUMENT`
2. **ID generation**: Use `incrementTemplateId()` instead of `incrementDocumentId()`
3. **Envelope creation**: Set `type: EnvelopeType.TEMPLATE`, `source: DocumentSource.TEMPLATE`
4. **Webhook**: Skip the `DOCUMENT_CREATED` webhook (current code already gates on `type === DOCUMENT`)

When `duplicateAsTemplate` is falsy, behavior is unchanged (preserves original type).

Behavioral changes for `includeRecipients` / `includeFields`:

- `includeRecipients: false` -- skip the entire recipient+field cloning block (the `pMap` over `envelope.recipients`)
- `includeFields: false` but `includeRecipients: true` -- clone recipients but pass empty `fields.createMany.data: []`
- Both default to `true` for backward compatibility

### New tRPC route: `envelope.saveAsTemplate`

**Route file**: `packages/trpc/server/envelope-router/save-as-template.ts`
**Types file**: `packages/trpc/server/envelope-router/save-as-template.types.ts`

Request schema:

```typescript
ZSaveAsTemplateRequestSchema = z.object({
  envelopeId: z.string(),
  includeRecipients: z.boolean().default(true),
  includeFields: z.boolean().default(true),
});
```

Response schema:

```typescript
ZSaveAsTemplateResponseSchema = z.object({
  id: z.string().describe('The ID of the newly created template envelope.'),
});
```

Route handler:

1. Validate the source envelope is `type === DOCUMENT` and `internalVersion === 2`
2. Call `duplicateEnvelope` with `overrides: { duplicateAsTemplate: true, includeRecipients, includeFields }`
3. Return `{ id: duplicatedEnvelope.id }`

Register in `packages/trpc/server/envelope-router/router.ts` as `saveAsTemplate`.

OpenAPI meta: `POST /envelope/save-as-template`.

## Frontend

### New dialog: `SaveAsTemplateDialog`

**File**: `apps/remix/app/components/dialogs/save-as-template-dialog.tsx`

Controlled dialog (open/onOpenChange pattern) matching `DocumentDuplicateDialog`.

Props:

```typescript
type SaveAsTemplateDialogProps = {
  envelopeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
```

Dialog content:

- **Title**: "Save as Template"
- **Description**: "Create a template from this document."
- **Checkboxes** (both checked by default):
  - "Include Recipients"
  - "Include Fields" -- auto-unchecked and disabled when "Include Recipients" is unchecked
- **Footer**: Cancel button + "Save as Template" button with loading state

Behavior:

- Calls `trpc.envelope.saveAsTemplate.useMutation`
- On success: navigate to `${templatesPath}/${newId}/edit`, show success toast
- On error: show error toast

### New dialog variant: `EnvelopeSaveAsTemplateDialog`

**File**: `apps/remix/app/components/dialogs/envelope-save-as-template-dialog.tsx`

Self-managed dialog state with trigger (matching `EnvelopeDuplicateDialog` pattern) for use in the envelope editor sidebar.

Props:

```typescript
type EnvelopeSaveAsTemplateDialogProps = {
  envelopeId: string;
  trigger?: React.ReactNode;
};
```

Same dialog content and behavior as `SaveAsTemplateDialog`, but uses internal `useState` for open state.

### Integration point 1: Envelope Editor V2 sidebar

**File**: `apps/remix/app/components/general/envelope-editor/envelope-editor.tsx`

Add `EnvelopeSaveAsTemplateDialog` below the existing "Duplicate Document" action (around line 467).

Gate: `isDocument && editorConfig.actions.allowSaveAsTemplate`

Icon: `FileOutputIcon` from Lucide.
Label: "Save as Template"

### Integration point 2: Documents table row dropdown

**File**: `apps/remix/app/components/tables/documents-table-action-dropdown.tsx`

Add a new `DropdownMenuItem` below "Duplicate" (line 141).

Gate: `row.internalVersion === 2`

Renders `SaveAsTemplateDialog` (controlled pattern) alongside existing `DocumentDuplicateDialog`.

### Integration point 3: Document index page dropdown

**File**: `apps/remix/app/components/general/document/document-page-view-dropdown.tsx`

Add a new `DropdownMenuItem` below "Duplicate" (line 114).

Gate: `envelope.internalVersion === 2`

Renders `SaveAsTemplateDialog` (controlled pattern).

### Editor config changes

**File**: `packages/lib/types/envelope-editor.ts`

Add `allowSaveAsTemplate: boolean` to the `actions` section of `ZEnvelopeEditorSettingsSchema`.

- `DEFAULT_EDITOR_CONFIG`: `allowSaveAsTemplate: true`
- `DEFAULT_EMBEDDED_EDITOR_CONFIG`: `allowSaveAsTemplate: false`

## Data Flow

```
User clicks "Save as Template"
  -> Dialog opens with checkbox options
  -> User confirms
  -> trpc.envelope.saveAsTemplate({ envelopeId, includeRecipients, includeFields })
  -> Route validates: type === DOCUMENT, internalVersion === 2
  -> duplicateEnvelope({ id, overrides: { duplicateAsTemplate: true, includeRecipients, includeFields } })
  -> Creates TEMPLATE envelope with cloned items, optionally recipients/fields
  -> Returns new envelope ID
  -> Frontend navigates to /t/{teamUrl}/templates/{newId}/edit
```

## Files Changed

| File                                                                         | Change                                                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/lib/server-only/envelope/duplicate-envelope.ts`                    | Add `overrides` to options, handle `duplicateAsTemplate` and `includeRecipients`/`includeFields` |
| `packages/trpc/server/envelope-router/save-as-template.ts`                   | New tRPC route                                                                                   |
| `packages/trpc/server/envelope-router/save-as-template.types.ts`             | New types file                                                                                   |
| `packages/trpc/server/envelope-router/router.ts`                             | Register `saveAsTemplate` route                                                                  |
| `apps/remix/app/components/dialogs/save-as-template-dialog.tsx`              | New controlled dialog                                                                            |
| `apps/remix/app/components/dialogs/envelope-save-as-template-dialog.tsx`     | New self-managed dialog                                                                          |
| `apps/remix/app/components/tables/documents-table-action-dropdown.tsx`       | Add "Save as Template" menu item                                                                 |
| `apps/remix/app/components/general/document/document-page-view-dropdown.tsx` | Add "Save as Template" menu item                                                                 |
| `apps/remix/app/components/general/envelope-editor/envelope-editor.tsx`      | Add "Save as Template" sidebar action                                                            |
| `packages/lib/types/envelope-editor.ts`                                      | Add `allowSaveAsTemplate` to editor config                                                       |
