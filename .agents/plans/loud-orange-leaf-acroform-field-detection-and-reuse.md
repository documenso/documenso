---
date: 2026-05-21
title: Acroform Field Detection And Reuse
---

## Problem

Users routinely prepare PDFs in Adobe Acrobat (or other PDF editors) with AcroForm fields — signatures, text inputs, dates, checkboxes — and upload them to Documenso. Today those widgets are either stripped (`DOCUMENT` upload flattens via `form.flatten()` in `normalize-pdf.ts`) or preserved as static interactive controls (`TEMPLATE` upload), but never reused as Documenso fields. Users have to re-place every field in the editor.

Issue: https://github.com/documenso/documenso/issues/2697 (labels: `type: enhancement`, `apps: web`).

## Goal

On upload, detect AcroForm fields, map supported types to Documenso fields, persist their page geometry, then flatten the PDF so no duplicate interactive controls remain. Imported fields should be ordinary `Field` rows — visible in the editor, assignable to recipients, signable like any other field.

## Background

The placeholder pipeline (`{{signature, r1}}` style) already does almost everything we need:

- `packages/lib/server-only/pdf/auto-place-fields.ts` extracts `PlaceholderInfo[]` (with `fieldAndMeta: TFieldAndMeta`, top-left percentages, page index), then `convertPlaceholdersToFieldInputs(placeholders, recipientResolver, envelopeItemId)` returns `tx.field.createMany` payloads.
- `packages/trpc/server/envelope-router/create-envelope.ts` per file: `convertToPdf` → optional `insertFormValuesInPdf` → `normalizePdf({ flattenForm: type !== 'TEMPLATE' })` → `extractPdfPlaceholders(normalized)` → `putPdfFileServerSide(cleanedPdf)` → forwards `{ title, documentDataId, placeholders }`.
- `packages/lib/server-only/envelope-item/create-envelope-items.ts` runs the same per-file pipeline when files are appended to an existing envelope.
- `packages/lib/server-only/envelope/create-envelope.ts` consumes `envelopeItems[].placeholders`, creates placeholder `SIGNER` recipients (`recipient.${i}@documenso.com`) when `data.recipients` is empty, then calls `convertPlaceholdersToFieldInputs` + `tx.field.createMany` inside its existing transaction.

`@libpdf/core` exposes the AcroForm primitives we need (verified in `node_modules/@libpdf/core/dist/index.d.mts`):

- `PDF.isEncrypted: boolean`, `PDF.getForm(): PDFForm | null`, `PDF.getPages()[i].ref` + `.getRotation()`.
- `PDFForm.getFields(): FormField[]`.
- `FormField`: `name`, `partialName`, `alternateName` (/TU), `isRequired()`, `isReadOnly()`, `acroField(): PdfDict` (raw dict access), `type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'listbox' | 'signature' | 'button' | 'unknown' | 'non-terminal'`.
- `WidgetAnnotation`: `rect`, `width`, `height`, `pageRef: PdfRef | null`, `isHidden()`, `isPrintable()`, `getOnValue()`.
- Typed subclasses: `CheckboxField.isChecked()` / `getOnValues()` / `getOnValue()`, `DropdownField.getOptions()`, `RadioField.getOptions()`, `SignatureField`, `TextField.getText()`.

`ZBaseFieldMeta` (in `packages/lib/types/field-meta.ts`) already carries `label`, `required`, `readOnly`. We extend it once with `source?: 'acroform'` so imported fields are introspectable without UI changes.

## Scope

In scope: server-side extraction at upload time for v2 envelopes (both new envelopes and items appended to existing envelopes), per-field `FIELD_CREATED` audit log entries for imported fields, and the one-line schema extension to record provenance. Out of scope: editor UI changes (badges, banners, review modals), signing surface changes, v1 path, listbox, button/unknown/non-terminal field types, true radio-group consolidation, recipient inference beyond first-signer selection.

## Field Mapping

### Type resolution

| AcroForm type | Documenso field | Rule |
| --- | --- | --- |
| `signature` (unsigned) | `SIGNATURE` | Import. |
| `signature` (signed — `acroField().has('V')` is true) | — | **Skip.** Log `logger.warn({ event: 'acroform-import.signed-signature', envelopeItemTitle, fieldName })`. Also downgrade `flattenForm` to `false` for that envelope item (do not re-flatten a signed PDF). |
| `text` | resolved by heuristic below | Heuristic order: AcroForm format action → name token → default to TEXT. |
| `checkbox` | `CHECKBOX` | One Documenso field per widget. |
| `radio` | `RADIO` | One Documenso field per widget. Store group's `getOptions()` in each `fieldMeta.values`. Semantics intentionally differ from PDF (each is independent); documented under Risks. |
| `dropdown` | `DROPDOWN` | Preserve `getOptions()` in `fieldMeta.values`, current selection in `fieldMeta.defaultValue`. |
| `listbox`, `button`, `unknown`, `non-terminal` | — | Skip, return as `AcroFormUnsupportedFieldInfo`. Never block upload. |

### Text-field heuristic (resolved in order — first match wins)

1. **DATE** if `acroField()` carries an additional-actions date format (`/AA` → `/F` → `S = JavaScript` referencing `AFDate_FormatEx`) **or** name/alternateName matches `/date|dob|birth_date|signed_date/i`.
2. **NUMBER** if `acroField()` carries an `AFNumber_Format` action **or** (`/MaxLen <= 10` AND name matches `/amount|qty|count|number|num\b/i`).
3. **EMAIL** if name/alternateName matches `/\bemail\b|e[-_]?mail/i`.
4. **NAME** if name/alternateName matches `/\bname\b|full_?name|first_?name|last_?name|fname\b|lname\b/i`.
5. **INITIALS** if name/alternateName matches `/initial(s)?\b|\binit\b/i`.
6. Else **TEXT**.

All regexes are case-insensitive and run against `partialName` then `alternateName`. False positives are reviewable in the editor; false negatives fall through to TEXT (always safe).

### Metadata mapping

For every imported field:

- `fieldMeta.required = field.isRequired()` (boolean; omit when false).
- `fieldMeta.readOnly = field.isReadOnly()` (boolean; omit when false). Read-only fields **are** imported (rendered for reference in the editor); the renderer already honours `readOnly`.
- `fieldMeta.label`: `alternateName ?? partialName` for label-supporting types (TEXT, NUMBER, DATE, INITIALS, NAME, EMAIL, DROPDOWN, RADIO, CHECKBOX). SIGNATURE has no label slot — drop it.
- `fieldMeta.source = 'acroform'` on every imported field (see Schema Extension).

### CHECKBOX required semantics

AcroForm "required" on a checkbox means "must be checked". Documenso CHECKBOX has both `required` (field must be present) and `validationRule`/`validationLength` (e.g. "at least N of M"). Mapping:

```ts
if (field.isRequired()) {
  fieldMeta.required = true;
  fieldMeta.validationRule = 'at-least';
  fieldMeta.validationLength = 1;
}
```

This approximates "must be checked to submit" for a single-widget checkbox field.

### Default values (only when `formValues` was NOT provided on this upload)

`formValues` (via `insertFormValuesInPdf`) is authoritative when present — it bakes values into the flattened background, so the imported fields stay empty for the signer to fill. When `formValues` is absent, we copy PDF defaults into `fieldMeta` so the editor preview matches the source PDF:

| Source | Target |
| --- | --- |
| `TextField.getText()` (non-empty) | `fieldMeta.text` (TEXT/DATE/INITIALS/NAME/EMAIL) or `fieldMeta.value` (NUMBER) |
| `DropdownField` current selection | `fieldMeta.defaultValue` |
| `CheckboxField.isChecked()` | `fieldMeta.values[0].checked = true` |
| `RadioField` current selection | `fieldMeta.values[i].checked = true` on the matching option |

Always emit `inserted: false` and `customText: ''` — the signer still confirms each field, defaults are editor-only hints.

All metadata flows through `ZEnvelopeFieldAndMetaSchema.parse(...)` so imported fields match what the editor already expects.

## Pre-extraction Guards

Run in this order before any AcroForm work:

1. **Encrypted PDFs**: if `pdfDoc.isEncrypted` → log `{ event: 'acroform-import.skip', reason: 'encrypted', envelopeItemTitle }`, return `{ fields: [], unsupported: [] }`. Upload proceeds with zero imported fields.
2. **XFA hybrid**: detect via the catalog's `AcroForm` dict carrying an `XFA` key (best-effort via raw dict access; if @libpdf/core's public surface can't read it, fall through — mirrored AcroForm fields in XFA hybrids are fine to import). When detected, log `{ event: 'acroform-import.skip', reason: 'xfa-hybrid' }` and return empty results.
3. **`getForm()` is null** → return empty results silently.
4. **Top-level try/catch** around steps 1–6: any throw → `logger.error({ event: 'acroform-import.error', envelopeItemTitle, err })`, return `{ fields: [], unsupported: [] }`. Upload proceeds untouched. Never bubble.

## Coordinate Handling

Reuse the placeholder convention (top-left percentages, see `auto-place-fields.ts:121-138`):

1. Build a page lookup once: `pages = pdfDoc.getPages(); pageByRef = new Map(pages.map((p, i) => [p.ref, i]))`.
2. For each widget:
   1. Read `widget.rect = [x1, y1, x2, y2]` (bottom-left, points).
   2. Normalize: `left = min(x1, x2)`, `right = max`, `bottom = min(y1, y2)`, `top = max`.
   3. Resolve `pageIndex` via `pageByRef.get(widget.pageRef)`. Skip if no match.
   4. Read `page.width`, `page.height`, `rot = page.getRotation()` (degrees, normalized to `0|90|180|270`).
   5. Apply inverse rotation transform so the field lands at the rendered top-left percentage:
      - `rot === 0`: `x = left`, `y = pageH - top`, `w = right - left`, `h = top - bottom`. Page dims `(pageW, pageH)`.
      - `rot === 90`: `x = bottom`, `y = left`, `w = top - bottom`, `h = right - left`. Page dims swap: `(pageH, pageW)`.
      - `rot === 180`: `x = pageW - right`, `y = top`, `w = right - left`, `h = top - bottom`. Page dims `(pageW, pageH)`.
      - `rot === 270`: `x = pageH - top`, `y = pageW - right`, `w = top - bottom`, `h = right - left`. Page dims swap.
   6. Out-of-bounds policy: if the entire rect is outside the rotated page bounds, skip + emit `AcroFormUnsupportedFieldInfo` with `reason: 'off-page'`. Otherwise clamp to `[0, renderedW] × [0, renderedH]`.
   7. Convert to percentages against the rendered page dimensions from step 5.
   8. Apply the existing `MIN_HEIGHT_THRESHOLD` / `DEFAULT_FIELD_HEIGHT_PERCENT` fallback used by placeholders.
3. Skip widgets that are `isHidden()` or have zero/negative `width`/`height` after normalization.

## Ordering

Sort imported fields before `createMany` by `(pageIndex asc, top-to-bottom, left-to-right)`. Concretely: ascending `pageIndex`, then ascending `y` (top-of-page first), then ascending `x` within `±2%` y-buckets so a row of fields stays a row. This matches how a signer visually scans the page; it does not rely on AcroForm `/Tabs` metadata (often wrong).

## Audit Logging

Every imported field emits one `FIELD_CREATED` entry matching `create-envelope-fields.ts:264`'s shape:

```ts
await tx.documentAuditLog.createMany({
  data: createdFields.map((f) => createDocumentAuditLogData({
    type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED,
    envelopeId: envelope.id,
    metadata: requestMetadata,
    data: { fieldId: f.secondaryId, fieldRecipientEmail, fieldRecipientId, fieldType: f.type },
  })),
});
```

The placeholder branch in `create-envelope.ts` is silent today and stays silent — AcroForm import does not retroactively change that. Distinguishing imported vs. placeholder vs. user-placed fields is done via `fieldMeta.source`, not a new audit type.

## Schema Extension

One field added to `ZBaseFieldMeta` in `packages/lib/types/field-meta.ts`:

```ts
export const ZBaseFieldMeta = z.object({
  // existing...
  source: z.enum(['acroform']).optional(),
});
```

No DB migration (fieldMeta is JSON). No editor change. No API contract change beyond the optional field. Forwards-compatible: future sources (`'placeholder'`, `'figma'`, etc.) extend the enum.

## Plan

### 1. Add the AcroForm extractor

New file `packages/lib/server-only/pdf/acroform-fields.ts`:

```ts
export type AcroFormFieldImportInfo = {
  source: 'acroform';
  fieldName: string;
  widgetIndex: number;
  fieldAndMeta: TFieldAndMeta;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
};

export type AcroFormUnsupportedFieldInfo = {
  fieldName: string;
  acroFormType: string;
  reason: 'unsupported-type' | 'hidden' | 'off-page' | 'zero-size' | 'no-page-match' | 'signed-signature';
};

export type AcroFormExtractionResult = {
  fields: AcroFormFieldImportInfo[];
  unsupported: AcroFormUnsupportedFieldInfo[];
  /** True when a signed signature widget was found — caller MUST set flattenForm: false for that item. */
  hasSignedSignature: boolean;
  /** True when extraction returned empty for a reason that should be surfaced in logs but not propagated. */
  skipReason?: 'encrypted' | 'xfa-hybrid' | 'no-form' | 'error';
};

export const extractAcroFormFieldsFromPDF = async (
  pdf: Buffer,
): Promise<AcroFormExtractionResult>;

export const convertAcroFormFieldsToFieldInputs = (
  fields: AcroFormFieldImportInfo[],
  recipientResolver: (fieldName: string) => Pick<Recipient, 'id'>,
  envelopeItemId?: string,
): FieldToCreate[];
```

`extractAcroFormFieldsFromPDF`:

- Wraps everything in try/catch (top-level guard).
- Loads via `PDF.load(new Uint8Array(pdf))`.
- Runs pre-extraction guards (encrypted, XFA, null form) — returns early with `skipReason` set.
- Builds the page-ref → index + rotation lookup once.
- Iterates `form.getFields()`, applies the type-resolution heuristic, geometry pipeline, default-value mapping.
- Records signed-signature widgets in `unsupported` with `reason: 'signed-signature'` AND sets `hasSignedSignature = true`.
- Logger is module-scoped (no apiRequestMetadata in this file — pure function).

`convertAcroFormFieldsToFieldInputs` mirrors `convertPlaceholdersToFieldInputs` — pure point→percentage transform, no DB access. After mapping, sort by `(page, y, x)` as in Ordering.

Kept separate from `auto-place-fields.ts`: placeholders are text-driven and emit white rectangles via `whiteoutRegions`; AcroForm import is widget-driven and relies on the post-extraction `form.flatten()` to clean the PDF. Sharing types prematurely would couple both paths.

### 2. Extract AcroForm fields before flattening

In both upload entry points the order becomes:

```
convertToPdf (router only)
  → insertFormValuesInPdf if formValues
  → extractAcroFormFieldsFromPDF(pdf)            // new — must run BEFORE normalizePdf
  → const shouldFlatten = type !== 'TEMPLATE' && !extraction.hasSignedSignature
  → normalizePdf({ flattenForm: shouldFlatten })
  → extractPdfPlaceholders(normalized)
  → putPdfFileServerSide(cleanedPdf)
  → forward { placeholders, acroFormFields, formValuesProvided }
```

Why before `normalizePdf`: for `DOCUMENT` uploads `normalizePdf` calls `form.flatten()` and destroys widget geometry. Extraction must read the unflattened buffer. `formValues` filling stays first so user-prefilled values still bake into the flattened background.

When `extraction.hasSignedSignature` is true, also `logger.warn({ event: 'acroform-import.signed-pdf-no-flatten', envelopeItemTitle })`.

`formValuesProvided` (boolean) is forwarded to the converter so the default-value mapping can skip prefill when the user-supplied values pipeline already filled the PDF.

Template flattening policy is unchanged in this plan: templates continue to preserve AcroForm widgets (no `form.flatten()`), so imported fields will visually duplicate the still-interactive PDF widgets in the template preview. Flipping templates to flatten is a follow-up — it's a breaking change for API users relying on template `formValues`.

### 3. Thread `acroFormFields` through `createEnvelope`

Extend `CreateEnvelopeOptions.data.envelopeItems[number]` (`packages/lib/server-only/envelope/create-envelope.ts:70-75`):

```ts
envelopeItems: {
  title?: string;
  documentDataId: string;
  order?: number;
  placeholders?: PlaceholderInfo[];
  acroFormFields?: AcroFormFieldImportInfo[];   // new
  formValuesProvided?: boolean;                  // new — already-applied prefill
}[];
```

Inside the existing transaction (alongside the `itemsWithPlaceholders` branch at `:431-538`), add an `itemsWithAcroFormFields` branch:

- Run AFTER the placeholder branch so `availableRecipients` reflects any placeholder signers it created.
- Recipient resolution:
  - **First-signer rule**: pick `availableRecipients.filter(r => r.role === SIGNER || r.role === APPROVER).sort((a, b) => (a.signingOrder ?? Infinity) - (b.signingOrder ?? Infinity) || a.id - b.id)[0]`.
  - If none: the placeholder branch may have created `Recipient 1` already — reuse. If still none (no recipients, no placeholders), create one placeholder `SIGNER` via the same `recipient.1@documenso.com` shape used by the placeholder branch.
  - All imported fields → that one recipient. User reassigns in editor.
- Call `convertAcroFormFieldsToFieldInputs(item.acroFormFields, resolver, envelopeItem.id)` then `tx.field.createMany(...)` with the same `{ envelopeId, envelopeItemId, recipientId, type, page, positionX, positionY, width, height, customText: '', inserted: false, fieldMeta }` shape used by the placeholder branch.
- Immediately after, emit per-field `FIELD_CREATED` audit log entries (see Audit Logging).

### 4. Mirror in `UNSAFE_createEnvelopeItems`

`packages/lib/server-only/envelope-item/create-envelope-items.ts:47-77` — carry `acroFormFields` and `formValuesProvided` alongside `placeholders` in `envelopeItemsToCreate`. Inside the existing `if (envelope.recipients.length > 0)` block (`:111-160`), after the placeholder loop, run the AcroForm loop using the same first-signer rule (SIGNER|APPROVER, signingOrder asc, id asc). Emit per-field `FIELD_CREATED` entries with `apiRequestMetadata`. If `envelope.recipients.length === 0`, skip — appending widgets to a recipient-less envelope is the user's setup phase and is handled when they add recipients (matches current placeholder behavior on append).

### 5. Log unsupported fields, never block upload

In both entry points, after extraction:

```ts
if (extraction.unsupported.length > 0) {
  logger.info({
    event: 'acroform-import.unsupported',
    envelopeItemTitle,
    count: extraction.unsupported.length,
    byReason: groupBy(extraction.unsupported, u => u.reason),
  });
}
if (extraction.skipReason) {
  logger.info({ event: 'acroform-import.skip', envelopeItemTitle, reason: extraction.skipReason });
}
```

No new error type, no upload rejection, no response-shape change. A UI surface for warnings comes later once the upload response has a stable warning shape.

### 6. Schema extension

`packages/lib/types/field-meta.ts`: add `source: z.enum(['acroform']).optional()` to `ZBaseFieldMeta`. Single-line change, no callers need updating because the field is optional.

## Files

| File | Change |
| --- | --- |
| `packages/lib/types/field-meta.ts` | Add `source?: 'acroform'` to `ZBaseFieldMeta`. |
| `packages/lib/server-only/pdf/acroform-fields.ts` | **new** — extractor, converter, types, pre-extraction guards, heuristics, geometry pipeline, ordering. |
| `packages/lib/server-only/envelope/create-envelope.ts` | Extend `CreateEnvelopeOptions.envelopeItems[]` with `acroFormFields` + `formValuesProvided`. Add AcroForm branch beside placeholder branch (~`:431-538`). Emit per-field `FIELD_CREATED` audit entries. |
| `packages/trpc/server/envelope-router/create-envelope.ts` | Insert `extractAcroFormFieldsFromPDF` before `normalizePdf` in the per-file loop (`:110-141`). Downgrade `flattenForm` when `hasSignedSignature`. Forward `acroFormFields` + `formValuesProvided` into the `envelopeItems` payload (`:135-140`). Log unsupported + skipReason. |
| `packages/lib/server-only/envelope-item/create-envelope-items.ts` | Insert `extractAcroFormFieldsFromPDF` before `normalizePdf` (`:48-77`). Same flatten downgrade. Carry `acroFormFields` + `formValuesProvided` in `envelopeItemsToCreate`. Add AcroForm loop inside `envelope.recipients.length > 0` (`:111-160`). Per-field audit entries. Log unsupported + skipReason. |
| `packages/lib/server-only/pdf/acroform-fields.test.ts` | **new** — unit suite (see Tests). |
| `packages/app-tests/e2e/scenarios/acroform-import.spec.ts` | **new** — e2e suite (see Tests). |
| `scripts/generate-acroform-test-pdf.mjs` | **new** — one-off generator (committed) producing `assets/acroform-import-test.pdf` + rotated variants. |
| `assets/acroform-import-test.pdf` | **new** — base fixture: one of each supported type. |
| `assets/acroform-import-rotated-90.pdf` | **new** — rotated-page fixture. |
| `assets/acroform-import-rotated-180.pdf` | **new** — rotated-page fixture. |
| `assets/acroform-import-rotated-270.pdf` | **new** — rotated-page fixture. |
| `assets/acroform-import-signed.pdf` | **new** — fixture with one signed signature widget + supported widgets. |

No DB schema change. No new tRPC route. No public API surface change beyond the optional `fieldMeta.source`.

## Tests

### Unit (`packages/lib/server-only/pdf/acroform-fields.test.ts`)

Drive from the committed fixture set; synthesize edge-case PDFs inline via `@libpdf/core`'s form builder where a static file is overkill.

Type resolution:
- text / signature / checkbox / radio / dropdown widgets each produce the expected Documenso field type.
- Heuristic positives: `signed_date` / `dob` → DATE; `initial` / `initials` → INITIALS; `customer_email` → EMAIL; `full_name` / `fname` → NAME; field with `AFNumber_Format` action → NUMBER; field with `MaxLen: 5` + name `qty` → NUMBER; plain `customer_id` → TEXT.
- AcroForm format actions take precedence over name tokens (a field named `customer_name` with an `AFDate_FormatEx` action → DATE).

Metadata:
- `isRequired` / `isReadOnly` round-trip into `fieldMeta`.
- `alternateName` (or `partialName` fallback) → `fieldMeta.label` on label-supporting types; SIGNATURE has no label.
- Required CHECKBOX → `required: true` + `validationRule: 'at-least'` + `validationLength: 1`.
- Every imported field has `fieldMeta.source = 'acroform'`.

Default values:
- TextField with non-empty value AND `formValuesProvided = false` → `fieldMeta.text` set.
- TextField with non-empty value AND `formValuesProvided = true` → `fieldMeta.text` NOT set.
- DropdownField selection → `fieldMeta.defaultValue`.
- CheckboxField checked → `values[0].checked = true`.
- RadioField selected → matching `values[i].checked = true`.

Geometry:
- Bottom-left widget rect `[100, 600, 200, 620]` on a 612×792 page → top-left percentages within ±0.01% of expected.
- 90° rotated page: same widget rect → rotated coordinates as defined in Coordinate Handling step 5.
- 180° and 270° rotated pages: same.
- Hidden widgets (annotation flags hidden bit) → skipped.
- Widgets with zero/negative dimensions → skipped.
- Widgets with `pageRef` not in `pdfDoc.getPages()` → `unsupported` with `reason: 'no-page-match'`.
- Widget rect entirely off-page → `unsupported` with `reason: 'off-page'`.
- Widget rect partially off-page → clamped, imported.

Ordering:
- Two pages × four widgets in scrambled creation order → output sorted by `(page, y, x)`.

Skips and unsupported:
- listbox / button / unknown / non-terminal → `unsupported`, never thrown.
- Encrypted PDF → `skipReason: 'encrypted'`, `fields: []`, no throw.
- XFA hybrid PDF (best-effort detect) → `skipReason: 'xfa-hybrid'` when detectable; otherwise extraction proceeds normally.
- Signed signature widget (`/V` present) → `unsupported` with `reason: 'signed-signature'` AND `hasSignedSignature: true`.
- Buffer corruption → top-level try/catch, returns empty + `skipReason: 'error'`, no throw.

### E2E (`packages/app-tests/e2e/scenarios/acroform-import.spec.ts`)

- Upload `assets/acroform-import-test.pdf` as a `DOCUMENT` via the v2 envelope router with one provided SIGNER recipient → assert envelope has one `Field` per supported widget, types match, `positionX/Y/width/height` within ±1% of expected, every field's recipient is that one SIGNER, stored PDF (`documentData`) loaded via `PDF.load` reports `getForm() === null` or `getFields().length === 0`. Audit log contains N `FIELD_CREATED` entries.
- Upload with `formValues` populated → `formValues` persists, imported fields exist but have no default values set in fieldMeta, the flattened PDF reflects the prefilled values.
- Upload with two recipients: one CC + one SIGNER → all imported fields assigned to the SIGNER (CC skipped).
- Upload with two recipients: one SIGNER (signingOrder=1) + one APPROVER (signingOrder=2) → all imported fields assigned to the SIGNER.
- Upload with zero recipients → placeholder `Recipient 1` created (shared with the placeholder branch's behavior; if both placeholders and AcroForm fields exist in the same file, only one `Recipient 1` exists).
- Upload `assets/acroform-import-signed.pdf` → signed signature widget skipped, other widgets imported, stored PDF is NOT flattened (`getForm() !== null`, widgets still present).
- Append `assets/acroform-import-test.pdf` to an existing envelope with one SIGNER via `UNSAFE_createEnvelopeItems` → new `envelopeItem.id` carries the imported fields, all assigned to that SIGNER.
- Append to a recipient-less envelope → AcroForm extraction runs, fields are NOT created (skipped, matching placeholder behavior).
- Upload `TEMPLATE` → template still preserves AcroForm widgets in the stored PDF (current behavior unchanged), imported fields ALSO exist (visual duplication acknowledged in Risks).
- Upload PDF with one `listbox` + one supported `text` field → upload succeeds, only the text field becomes a Documenso field, log line emitted for the listbox.
- Upload rotated PDFs (90/180/270 fixtures) → field geometry lands within ±1% of the expected rendered position on each page.

### Regression

```bash
npx tsc --noEmit -p apps/remix/tsconfig.json
npm run test:dev -w @documenso/app-tests -- packages/app-tests/e2e/scenarios/form-flattening.spec.ts
npm run test:dev -w @documenso/app-tests -- packages/app-tests/e2e/scenarios/acroform-import.spec.ts
```

## Behavior Matrix

| Upload | Has AcroForm | Signed sig? | `formValues`? | `recipients`? | Result |
| --- | --- | --- | --- | --- | --- |
| `DOCUMENT` | yes | no | none | 1 SIGNER/APPROVER | All imported fields → that recipient. Stored PDF flat. Per-field `FIELD_CREATED` audit. |
| `DOCUMENT` | yes | no | none | N≥2 mixed roles | All imported fields → first SIGNER|APPROVER by (signingOrder asc, id asc). CC/VIEWER skipped. User reassigns in editor. |
| `DOCUMENT` | yes | no | none | only CC/VIEWER | Treated as "no signable recipients" — placeholder `Recipient 1` SIGNER created. |
| `DOCUMENT` | yes | no | none | none | One placeholder `Recipient 1` SIGNER created (reused if placeholder branch already made one). |
| `DOCUMENT` | yes | no | provided | any | `formValues` filled → flattened values visible → empty supported fields imported with `source: 'acroform'`, no `fieldMeta.text`/`defaultValue` prefill. |
| `DOCUMENT` | yes | yes | any | any | Signed signature(s) skipped + logged. `flattenForm` downgraded to false → stored PDF retains widgets. Other supported widgets imported normally. |
| `DOCUMENT` | no | n/a | any | any | Unchanged. |
| `TEMPLATE` | yes | n/a | any | any | Imported fields created **and** PDF still contains interactive widgets (known artifact, follow-up). |
| Encrypted PDF | n/a | n/a | any | any | Extraction skipped + logged. Upload proceeds with zero AcroForm imports. |
| XFA hybrid (detected) | n/a | n/a | any | any | Extraction skipped + logged. Same as encrypted. |
| Append to existing envelope w/ recipients | yes | no | n/a | n/a | Imported fields → first SIGNER|APPROVER of the envelope. Per-field audit. |
| Append to existing envelope w/o recipients | yes | n/a | n/a | n/a | Skipped (matches current placeholder behavior on append). |

## Out of Scope / Follow-ups

- Flipping `TEMPLATE` uploads to flatten after import — breaking for API users relying on template AcroForm `formValues`.
- Editor UI surface: "Imported from PDF" badge (using `fieldMeta.source`), warning toast for skipped widgets, encrypted/XFA banner. Data is captured now; UI ships separately.
- A signed-AcroForm-signature → completed Documenso signature mapping.
- True radio-group consolidation (one Documenso field per AcroForm radio group instead of per widget) — needs `fieldMeta` schema extension for multi-position groups.
- Same-name multi-widget non-radio fields (one AcroForm text field rendered on N pages) — currently emit N independent Documenso fields; future work could sync values at signing time via a shared `groupId` in fieldMeta.
- Listbox support.
- Recipient inference from PDF authoring metadata (Adobe's role/recipient hints, tab order grouping).
- AcroForm `/Tabs` ordering as a signal — current spatial sort suffices.

## Risks

- **Rotated pages**: covered by inverse-rotation transform with 90/180/270 fixtures gating the unit suite. Skewed rotations (non-cardinal) are not supported; should be rejected as `off-page` if their normalized rect doesn't land within page bounds.
- **Radio groups**: emitting one Documenso field per widget will look right visually but signing semantics differ from a single PDF radio group (each option becomes independently checkable). Gating fixture in e2e covers visual placement; signing semantics divergence is documented and ships as a known limitation.
- **Template behavior**: leaving `TEMPLATE` uploads unflattened means imported fields and live widgets coexist. Acceptable for v1, but the template preview will show duplicated controls.
- **Signed signature + flattenForm downgrade**: a `DOCUMENT` upload containing a signed signature now stores an un-flattened PDF. Existing code paths that assume `DOCUMENT` PDFs are always flat (signing renderer, downstream conversion) MUST be re-verified — add an integration check in the e2e suite that signing still works on the signed-fixture envelope.
- **Recipient ambiguity**: AcroForm widgets don't encode Documenso recipients. Deterministic "all to first signer" + editor review is the safest first cut; smarter assignment is a follow-up.
- **XFA detection**: best-effort; if @libpdf/core's public surface doesn't expose the catalog AcroForm dict, we fall through and import any mirrored AcroForm fields. Acceptable — XFA-only PDFs with no mirror produce empty AcroForm extraction and the upload proceeds. Worst case is a noisy log line on a misclassified hybrid.
- **Heuristic false positives**: expanded heuristic (NAME/EMAIL/NUMBER/DATE/INITIALS) increases the chance of mis-typing a field. Mitigation: every imported field is editable in the editor before sending. False negatives fall through to TEXT (always safe).
