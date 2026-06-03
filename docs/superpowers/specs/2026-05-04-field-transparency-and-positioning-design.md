# Field Transparency and Per-Item Positioning

**Date:** 2026-05-04
**Status:** Approved
**Triggered by:** User feedback on IHCP (Individualized Health Care Plan) template. Field outlines obscure document text, checkbox groups can't align to variable-width form labels.

## Problem

1. Checkbox and radio fields render with `bg-white/90 ring-2` in the signing view, creating a near-opaque white rectangle that hides the document text underneath. On dense forms like the IHCP, this makes parts of the form unreadable.

2. Checkbox/radio groups render items in a flex container with uniform spacing (`gap-1`). On forms where checkbox labels have varying lengths (e.g., "Before breakfast" vs "As Needed ONLY"), the checkboxes can't be aligned to the corresponding document text.

3. There is no way to group independent checkbox/radio fields for cross-field validation (e.g., "select at least 1 from these 5 checkboxes"). This is out of scope for now but we want scaffolding.

## Design

### 1. Field Transparency (Checkbox/Radio Only)

**File:** `packages/ui/components/field/field.tsx` — `FieldRootContainer`

Current classes on the container div (line 140):
```
bg-white/90 ring-2 ring-gray-200 ... [color?.base which adds ring-recipient-green etc.]
```

Change: when `field.type` is `CHECKBOX` or `RADIO`, apply:
```
bg-transparent ring-1
```

Instead of:
```
bg-white/90 ring-2
```

The recipient color ring class (`ring-recipient-green`, etc.) still applies via `color?.base`. The reduced visual weight is handled entirely in `FieldRootContainer` using a conditional on `field.type`:

```typescript
const isCheckboxOrRadio = field.type === FieldType.CHECKBOX || field.type === FieldType.RADIO;

className={cn(
  'field--FieldRootContainer ... transition-all',
  isCheckboxOrRadio
    ? 'bg-transparent ring-1 ring-opacity-40'
    : 'bg-white/90 ring-2 ring-gray-200',
  color?.base,
  // ... rest unchanged
)}
```

Do NOT modify `generateStyles()` in `recipient-colors.ts`. That function receives only `recipientColor`, not field type, so it cannot distinguish checkbox/radio from other fields. The field-type-specific styling belongs in `FieldRootContainer` where `field.type` is available.

All other field types (SIGNATURE, TEXT, NAME, EMAIL, DATE, NUMBER, DROPDOWN, FREE_SIGNATURE, INITIALS) keep current rendering unchanged.

**Also update:** `document-read-only-fields.tsx` if it applies the same background pattern for checkbox/radio. `FieldContainerPortal` does not apply background styles (it only handles positioning), so no changes needed there.

### 2. Per-Item Positioning

#### Schema Changes

**File:** `packages/lib/types/field-meta.ts`

Extend the value item schema in both `ZRadioFieldMeta` and `ZCheckboxFieldMeta`:

```typescript
values: z.array(
  z.object({
    id: z.number(),
    checked: z.boolean(),
    value: z.string(),
    offsetX: z.number().min(-100).max(100).optional(),  // percentage of page width, relative to field origin
    offsetY: z.number().min(-100).max(100).optional(),  // percentage of page height, relative to field origin
  }),
).optional(),
```

The `.min(-100).max(100)` bounds prevent UI redressing attacks where a sender could position checkboxes off-screen to mislead signers. This follows the same pattern as `fontSize: z.number().min(8).max(96)` in the existing schema.

Add `'custom'` to the `direction` enum:

```typescript
direction: z.enum(['vertical', 'horizontal', 'custom']).optional().default('vertical'),
```

#### Editor Changes

**Files:**
- `apps/remix/app/components/forms/editor/editor-field-checkbox-form.tsx`
- `apps/remix/app/components/forms/editor/editor-field-radio-form.tsx`
  (or the shared generic form if these share a component)

Changes:
- Keep existing horizontal/vertical direction toggle
- When direction changes to horizontal/vertical, auto-calculate evenly-spaced offsets for all items and clear any manual offsets
- Add a collapsible "Item Positions" section below the direction toggle
- Each item row shows: item label + X offset input + Y offset input (number inputs, in percentage units matching `positionX`/`positionY` coordinate system)
- When a user manually edits any offset, direction automatically switches to `'custom'`
- Offsets default to `undefined` (no offset = use flex layout fallback)

**Editor form schema sync:** `ZCheckboxFieldFormSchema` and `ZRadioFieldFormSchema` use `.pick()` from the base meta schemas. They must be updated to include `'custom'` in their direction enum, even though the Select dropdown only shows "Vertical" and "Horizontal" as user-selectable options. When direction is `'custom'`, the Select should display "Custom" but be non-interactive (the value is set programmatically by editing offsets, not by selecting from the dropdown). This prevents the editor from clobbering a `'custom'` direction value back to `'vertical'` on save.

#### Signing View Changes

**Files:**
- `apps/remix/app/components/general/document-signing/document-signing-checkbox-field.tsx`
- `apps/remix/app/components/general/document-signing/document-signing-radio-field.tsx`

Changes:
- Check `parsedFieldMeta.direction === 'custom'` to determine positioning mode
- If direction is `'custom'`: all items must have `offsetX` and `offsetY` set. Render items with relative positioning using the offset values, converting from page-percentage to pixels using the same coordinate system as `useFieldPageCoords`
- If direction is `'vertical'` or `'horizontal'` (or any item lacks offsets): use the current flex layout (`flex-row`/`flex-col` with `gap-1`). Existing fields render identically with no migration needed
- Guard against NaN/Infinity: if page dimensions from `useFieldPageCoords` are 0 or undefined during initial render, fall back to flex layout regardless of offset values

#### Read-Only / PDF Flattening

If checkbox/radio field values are flattened into the final PDF (for completed documents), the offset positioning must also apply there. Check `document-read-only-fields.tsx` and any server-side PDF rendering for consistency.

### 3. Scaffolding for Future Field Grouping

No user-facing changes. Schema prep only.

**File:** `packages/lib/types/field-meta.ts`

Add to `ZBaseFieldMeta`:
```typescript
groupId: z.string().max(64).regex(/^[a-zA-Z0-9_-]+$/).optional(),
```

The length and format constraints prevent storage bloat and ensure the value is safe for use as a lookup key when cross-field grouping is eventually built. The `groupId` on `ZBaseFieldMeta` is the future join key: fields sharing a `groupId` will form a validation group.

**Do not** create `field-group-validation.ts` yet. The only current call site is `validateCheckboxLength`, which works fine as-is. Extract the generic validation function when there are 2+ consumers (i.e., when cross-field grouping is actually built). Leave `validateCheckboxLength` unchanged for now.

## Scope Boundaries

**In scope:**
- Transparency change for checkbox/radio in signing view
- Per-item offset schema and editor UI
- Offset-aware rendering in signing view
- Scaffolding: `groupId` field on `ZBaseFieldMeta` (schema only, no validation utility)

**Out of scope:**
- Drag-and-drop positioning of individual items on the canvas
- Cross-field grouping UI
- Cross-field validation enforcement
- Changes to non-checkbox/radio field types
- Changes to the template editor canvas (Konva layer)

## Migration

No database migration needed. The schema changes are additive (new optional fields in JSON metadata). Existing fields without offsets or groupId render identically via the flex layout fallback.
