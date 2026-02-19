# V2 Envelope Embedding System — Overview

## Architecture

The V2 embedding system replaces the V1 iframe-based document/template authoring system with a unified **"envelope"**-based model. Instead of 4 separate components (`EmbedCreateDocumentV1`, `EmbedCreateTemplateV1`, `EmbedUpdateDocumentV1`, `EmbedUpdateTemplateV1`), V2 unifies everything around an "envelope" that can contain multiple PDF items, recipients, and fields.

### Key Concepts

- **Envelope**: A container holding one or more PDF documents, recipients, and fields. Replaces the V1 single-document model.
- **Presign Token**: Short-lived token exchanged from an API key, scoped to specific operations (e.g., `envelope:{id}`). Used for iframe authentication instead of session cookies.
- **Feature Flags (Hash Config)**: JSON config passed via URL hash fragment to control which UI elements are visible/editable in the embedded editor. 5 categories with ~25 flags.
- **Local Mode**: In embedded create mode, all mutations (add recipient, add field, etc.) happen locally with auto-incrementing negative IDs — no network calls until the final "create" action.
- **EditorConfig**: Runtime config object built from feature flags that controls the editor's behavior (which steps to show, which actions to allow, which settings to render).

---

## Files Changed (~40 files)

### New Routes (`apps/remix/app/routes/embed+/`)

| File                                        | Purpose                                                                                                                                                                                                                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v2+/authoring+/_layout.tsx`                | Layout/auth wrapper. Verifies presign tokens, sets up fake team/org providers (hardcoded team ID=1, org ID='123'), injects CSS/cssVars for white-labeling, wraps children in `TrpcProvider`, `LimitsProvider` (with `bypassLimits=true`), `OrganisationProvider`, `TeamProvider`. |
| `v2+/authoring+/envelope.create._index.tsx` | Create envelope page. Loads team settings for defaults, builds blank `TEditorEnvelope`, parses feature flags from URL hash, handles `createEmbeddingEnvelope` mutation (FormData with payload + files), posts `envelope-created` message to parent window.                        |
| `v2+/authoring+/envelope.edit.$id.tsx`      | Edit envelope page. Loads existing envelope by ID, verifies presign token with scope `envelope:{id}`. **Currently broken — won't compile** (see Issues section).                                                                                                                  |
| `v2+/authoring_.completed.create.tsx`       | Completion page. Marked as "not being used" via Todo comment.                                                                                                                                                                                                                     |
| `v2+/multisign+/_index.tsx`                 | Multi-document signing view. Lists multiple documents for a recipient to sign sequentially. Handles `document-completed`, `document-rejected`, `document-error`, `document-ready`, `all-documents-completed` postMessage events.                                                  |
| `dummy.tsx`                                 | Internal test/dev page (606 lines). Full control panel with all feature flags, CSS theming, token exchange (api\_ -> presign token), iframe rendering, and postMessage monitoring.                                                                                                |

### New Types & Utils (`packages/lib/`)

| File                                    | Purpose                                                                                                                                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types/envelope-editor.ts`              | Zod schemas: `ZBaseEmbedAuthoringFeaturesSchema` (5 feature categories), `ZBaseEmbedAuthoringSchema`, `ZBaseEmbedAuthoringEditSchema` (adds `onlyEditFields`), `ZEditorEnvelopeSchema`.                              |
| `utils/embed-config.ts`                 | `buildEditorConfigFromFeatures()` — maps parsed feature flags to `EnvelopeEditorConfig` with sensible defaults for embedded mode (e.g., `minimizeLeftSidebar: true`, most actions disabled).                         |
| `client-only/hooks/use-editor-query.ts` | Dual-mode hook (`trpc` vs `local`). Local mode simulates mutations with auto-incrementing negative IDs, no network calls. **Currently unused** — provider still uses direct trpc mutations with `isEmbedded` checks. |

### Modified Providers (`packages/lib/client-only/providers/`)

| File                           | Changes                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `envelope-editor-provider.tsx` | Added `EnvelopeEditorConfig` type (5 config sections + `embeded` config). Added `isEmbedded` flag, local-only mapping functions (`mapLocalRecipientsToRecipients`, `mapLocalFieldsToFields`), embedded path handling, `flushAutosave()`. When embedded, skips trpc mutations and maps locally. |
| `envelope-render-provider.tsx` | Added `presignToken` prop, local file rendering via `pdfToImagesClientSide` when envelope ID is empty (embedded create mode), handling of `PRESIGNED_` prefixed items.                                                                                                                         |

### TRPC Changes (`packages/trpc/server/embedding-router/`)

| File                                      | Purpose                                                                                                                                                                                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_router.ts`                              | Added `createEmbeddingEnvelope` route registration.                                                                                                                                                                                          |
| `create-embedding-envelope.ts`            | New mutation. Accepts FormData (payload JSON + files), verifies presign token, normalizes PDFs, extracts placeholders, uploads to storage, creates envelope. Duplicated from `create-envelope.ts` with presign auth instead of session auth. |
| `create-embedding-envelope.types.ts`      | Reuses `ZCreateEnvelopePayloadSchema`, wraps in `zodFormData`.                                                                                                                                                                               |
| `create-embedding-presign-token.types.ts` | Added `scope` field to presign token request (e.g., `envelope:envelope_123`).                                                                                                                                                                |

### Modified Components (`apps/remix/app/components/`)

| File                                            | Changes                                                                                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `envelope-editor.tsx`                           | Reads `editorConfig` for which steps/actions to show/hide. Respects `minimizeLeftSidebar`, conditional rendering of quick actions.                                      |
| `envelope-editor-header.tsx`                    | Added embedded create/update buttons that call `flushAutosave()` then `embeded.onCreate/onUpdate`. Conditionally shows branding, attachments, settings based on config. |
| `envelope-editor-upload-page.tsx`               | When `isEmbedded`, files are stored locally as `Uint8Array` on `envelopeItems` with `PRESIGNED_` prefix IDs instead of being uploaded immediately.                      |
| `envelope-editor-recipient-form.tsx`            | Reads `editorConfig.recipients` to hide/show role options (approver, viewer, CC, assistant), signing order, dictate next signer.                                        |
| `envelope-editor-settings-dialog.tsx`           | Reads `editorConfig.settings` to conditionally render each setting section.                                                                                             |
| `envelope-editor-renderer-provider-wrapper.tsx` | **New.** Wrapper that passes `presignedToken` to `EnvelopeRenderProvider`.                                                                                              |
| `envelope-delete-dialog.tsx`                    | **New.** Delete dialog for envelopes.                                                                                                                                   |
| `envelope-distribute-dialog.tsx`                | Minor changes to use `useCurrentEnvelopeEditor`.                                                                                                                        |
| `document-attachments-popover.tsx`              | Changed to use string envelope IDs.                                                                                                                                     |
| `recipient-role-select.tsx`                     | Added `hideAssistantRole`, `hideCCerRole`, `hideViewerRole`, `hideApproverRole` props.                                                                                  |
| `add-template-placeholder-recipients.tsx`       | Added role hiding props passthrough.                                                                                                                                    |
| `limits/provider/client.tsx`                    | Added `bypassLimits` prop to skip limit fetching for embedded mode.                                                                                                     |

### Feature Flag Schema

5 categories with ~25 flags controlling embedded editor behavior:

```
general:
  allowConfigureSigningOrder    # Show signing order controls
  allowPersonalizeRecipient     # Allow recipient customization

settings:
  showGeneralSettings           # General settings section
  showSigningSettings           # Signing-specific settings
  showAdvancedSettings          # Advanced settings section
  showNotificationSettings      # Notification preferences
  showAccessSettings            # Access/permission settings

actions:
  allowDistributeAction         # Show distribute button
  allowDirectLinkAction         # Show direct link button
  allowDuplicateAction          # Show duplicate button
  allowDownloadAction           # Show download button
  allowDeleteAction             # Show delete button
  allowReturnAction             # Show return/back button
  allowAttachments              # Show attachments popover

envelopeItems:
  allowAdd                      # Add new PDFs
  allowDelete                   # Remove PDFs
  allowConfigureTitle           # Edit PDF titles
  allowConfigureOrder           # Reorder PDFs

recipients:
  showApproverRole              # Show approver role option
  showViewerRole                # Show viewer role option
  showCCRole                    # Show CC role option
  showAssistantRole             # Show assistant role option
  showSigningOrder              # Show signing order controls
  showDictateNextSigner         # Show dictate next signer
```

---

## Issues & Missing Pieces

### Critical — Won't Compile

**`envelope.edit.$id.tsx`** has the following problems:

1. References `TUpdateEnvelopePayload` and `TUpdateEmbeddingDocumentPayload` — **types don't exist**.
2. Uses `trpc.embeddingPresign.updateEmbeddingDocument.useMutation()` — **mutation doesn't exist**. There is no `update-embedding-envelope.ts` in the embedding router.
3. Missing imports: `EnvelopeType`, `Trans`.
4. `buildUpdateEnvelopeRequest` returns `{ payload: TUpdateEnvelopePayload, files: File[] }` but `TUpdateEnvelopePayload` is undefined.

**Fix required:** Create `update-embedding-envelope.ts` + types in the trpc embedding router, register in `_router.ts`, fix all imports.

### Explicit TODOs in Code

| Location                          | Todo                                                                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_layout.tsx`                     | Session provider missing — any `useSession()` call will crash. Need E2E tests.                                                                                                           |
| `envelope.create._index.tsx`      | Presign token scope handling for create mode.                                                                                                                                            |
| `envelope.edit.$id.tsx`           | Handle `onlyEditFields` (skip to fields step). Check externalId handling on postMessage.                                                                                                 |
| `authoring_.completed.create.tsx` | Not being used — dead code.                                                                                                                                                              |
| `envelope-editor-provider.tsx`    | `setEnvelope` wrapper ("WTf"). Embedded path handling needs more thought. `authOptions: null` not mapped in local mode. `Prisma.Decimal` used client-side may have bundle/compat issues. |
| `envelope-render-provider.tsx`    | `PRESIGNED_` items with data logged but not handled.                                                                                                                                     |
| `envelope-editor-header.tsx`      | Logo link and white-label not properly handled.                                                                                                                                          |
| `envelope-editor.tsx`             | Delete action navigation in embedded mode unclear.                                                                                                                                       |

### Missing Features

| Feature                                             | Status                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `updateEmbeddingEnvelope` mutation                  | Not created — edit flow has no backend endpoint                                            |
| `use-editor-query.ts` hook integration              | Created but unused — provider still manually branches on `isEmbedded`                      |
| E2E tests                                           | None exist                                                                                 |
| V2 React SDK components (`@documenso/embed-react`)  | V1 had wrapper components; no V2 equivalents                                               |
| Template support                                    | Code references `EnvelopeType.TEMPLATE` but routes hardcode `DOCUMENT`                     |
| Error route (`/embed/v2/authoring/error/not-found`) | Does not exist                                                                             |
| `onlyEditFields`                                    | Parsed but not implemented                                                                 |
| Session provider in embed layout                    | Missing — `useSession()` calls will crash                                                  |
| White-label branding                                | Logo/link hardcoded in header                                                              |
| Attachments in create mode                          | `DocumentAttachmentsPopover` queries with empty envelope ID                                |
| postMessage origin security                         | All calls use `'*'` as target origin                                                       |
| Documentation                                       | V1 docs at `apps/documentation/pages/developers/embedded-authoring.mdx` not updated for V2 |

### Feature Flags Not Fully Enforced

| Flag                                | Issue                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `envelopeItems.allowConfigureTitle` | Upload page has title input but doesn't check this flag                                 |
| `envelopeItems.allowConfigureOrder` | Drag reordering doesn't check this flag                                                 |
| `envelopeItems.allowDelete`         | Delete button uses `canItemsBeModified` from envelope status, not this flag             |
| `actions.allowAttachments`          | Checked in header but attachments popover won't work without envelope ID in create mode |

---

## Priority Order for Next Steps

1. **Fix edit flow** — Create `update-embedding-envelope` mutation + types, fix imports in `envelope.edit.$id.tsx`
2. **Wire up `use-editor-query.ts`** — Replace manual `isEmbedded` branching in `envelope-editor-provider.tsx`
3. **Handle session provider** — Add fake session provider or ensure all components use `useOptionalSession()`
4. **Implement `onlyEditFields`** — Skip to fields step when flag is set
5. **Make envelope type configurable** — Support `TEMPLATE` via hash params or presign token scope
6. **Create error route** — `/embed/v2/authoring/error/not-found`
7. **Enforce all feature flags** — Wire remaining flags into upload page components
8. **Fix authOptions mapping** — Map recipient auth options in local mode
9. **Create V2 React SDK components** — `@documenso/embed-react` wrappers for iframe + postMessage
10. **Add E2E tests** — Cover create, edit, multi-sign flows
11. **Update documentation** — Reflect V2 API in developer docs
12. **PostMessage security** — Replace `'*'` with proper target origin
