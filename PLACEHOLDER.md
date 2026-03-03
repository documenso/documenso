# PDF Placeholder Fields

Documenso can detect special placeholder text embedded in a PDF and automatically create signing fields at those locations. This removes the need to manually position fields after upload.

## Placeholder Syntax

```
{{FIELD_TYPE, rN, option=value, option=value}}
```

Both `=` and `:` are accepted as the key/value separator for options.

| Part | Description | Example |
|---|---|---|
| `FIELD_TYPE` | The type of field to create — full name or short alias (case-insensitive) | `signature`, `t` |
| `rN` | Recipient reference — `r1` maps to the first recipient, `r2` to the second, etc. | `r1` |
| `option=value` | Zero or more key/value options using `=` or `:` as separator | `required=true`, `r:t` |

### Supported field types

| Short | Full name |
|---|---|
| `s` | `signature` |
| `fs` | `free_signature` |
| `i` | `initials` |
| `n` | `name` |
| `e` | `email` |
| `d` | `date` |
| `t` | `text` |
| `num` | `number` |
| `r` | `radio` |
| `cb` | `checkbox` |
| `dd` | `dropdown` |

### Supported options

Both the full property name and the short alias are accepted. The `=` and `:` separators are interchangeable.

#### Common options (all field types)

| Short | Full | Type | Notes |
|---|---|---|---|
| `r` | `required` | `true`/`false` or `t`/`f` | Field must be filled before signing |
| `ro` | `readOnly` | `true`/`false` or `t`/`f` | Field is locked; value cannot be changed |
| `f` | `fontSize` | number (8–96) | Font size in points |
| `l` | `label` | string† | Display label shown above the field |
| `p` | `placeholder` | string† | Ghost text shown before signing |
| `id` | `fieldId` | string | Identifier for referencing this field |

#### Text layout options (text, number, initials, name, email, date)

| Short | Full | Type | Notes |
|---|---|---|---|
| `ta` | `textAlign` | `left`/`right`/`center` or `l`/`r`/`c` | Horizontal text alignment |
| `va` | `verticalAlign` | `top`/`middle`/`bottom` or `t`/`m`/`b` | Vertical text alignment |
| `lh` | `lineHeight` | number (1–10) | Line height multiplier |
| `ls` | `letterSpacing` | number (0–100) | Spacing between characters |

#### Text field options

| Short | Full | Type | Notes |
|---|---|---|---|
| `t` | `text` | string† | Pre-filled text value |
| `cl` | `characterLimit` | number | Maximum number of characters |

#### Number field options

| Short | Full | Type | Notes |
|---|---|---|---|
| `v` | `value` | string | Pre-filled number value |
| `nf` | `numberFormat` | string | Display format (e.g. `1,234.56`) |
| `min` | `minValue` | number | Minimum allowed value |
| `max` | `maxValue` | number | Maximum allowed value |

#### Radio and checkbox options

| Short | Full | Type | Notes |
|---|---|---|---|
| `dir` | `direction` | `vertical`/`horizontal` or `v`/`h` | Layout direction of options |

#### Checkbox-only options

| Short | Full | Type | Notes |
|---|---|---|---|
| `vr` | `validationRule` | string | Validation rule identifier |
| `vl` | `validationLength` | number | Required number of checked boxes |

#### Dropdown options

| Short | Full | Type | Notes |
|---|---|---|---|
| `dv` | `defaultValue` | string | Pre-selected option value |

> **†** `label`, `placeholder`, and `text` values are decoded from underscore-encoded form — underscores become spaces and each word is title-cased (see below).

> **Note:** `signature` and `free_signature` fields do not support any options — options provided for those types are silently ignored.

#### String value encoding

For `label`, `placeholder`, and `text`, underscores are decoded into spaces and each word is title-cased automatically. All other string properties (`fieldId`, `value`, `numberFormat`, `defaultValue`, etc.) are passed through as-is.

```
l:my_field_name     →  label:       "My Field Name"
p:enter_amount      →  placeholder: "Enter Amount"
t:default_text_1    →  text:        "Default Text 1"
```

#### Short value aliases

| Property | Short → Full |
|---|---|
| `required`, `readOnly` | `t` → `true`, `f` → `false` |
| `textAlign` | `l` → `left`, `r` → `right`, `c` → `center` |
| `verticalAlign` | `t` → `top`, `m` → `middle`, `b` → `bottom` |
| `direction` | `v` → `vertical`, `h` → `horizontal` |

### Examples

Long form (original syntax — still fully supported):
```
{{signature, r1}}
{{text, r2, required=true, fontSize=14}}
{{date, r1, readOnly=true}}
{{number, r3, minValue=0, maxValue=100}}
{{checkbox, r1, direction=horizontal}}
{{dropdown, r2, defaultValue=Option_A}}
```

Short form (new aliases):
```
{{s, r1}}
{{t, r1, r:t, ro:f, f:8, ta:l, va:m, lh:1.2, ls:0, l:label_1, p:placeholder_1, t:text_1, cl:100, id:text_1}}
{{num, r2, min:0, max:100, v:50, nf:1_234.56, r:t}}
{{cb, r1, dir:h, vr:atLeastOne, vl:1}}
{{dd, r2, dv:option_a}}
{{e, r1, ro:t}}
```

The text field example `{{t, r1, r:t, ro:f, f:8, ta:l, ...}}` creates a `text` field for recipient 1 that is:
- `r:t` — required
- `ro:f` — not read-only
- `f:8` — font size 8
- `ta:l` — text aligned left
- `va:m` — vertically centred
- `lh:1.2` — line height 1.2×
- `ls:0` — no letter spacing
- `l:label_1` — label "Label 1"
- `p:placeholder_1` — placeholder "Placeholder 1"
- `t:text_1` — pre-filled text "Text 1"
- `cl:100` — character limit 100
- `id:text_1` — fieldId "text_1"

---

## How it works

### 1. Upload (extraction)

When a PDF is uploaded — either to create a new envelope or to add items to an existing one — Documenso:

1. Normalizes the PDF (flattens form fields for non-templates).
2. Scans every page for text matching `{{...}}` using the regex `/\{\{([^}]+)\}\}/g`.
3. For each match, parses the field type, recipient reference, and options.
4. Records the bounding box (page, x, y, width, height) in the PDF's native coordinate system (points, bottom-left origin). Coordinates are converted to top-left origin for internal use.
5. Draws **white rectangles** over each placeholder location so the raw placeholder text is hidden from signers.
6. Uploads the cleaned PDF to storage and retains the extracted placeholder data in memory for the next step.

**Entry points:**
- `packages/trpc/server/envelope-router/create-envelope.ts` — new envelope creation
- `packages/trpc/server/envelope-router/create-envelope-items.ts` — adding items to an existing envelope

### 2. Field creation (placement)

If recipients are already present on the envelope at the time of upload, fields are created automatically from the placeholders inside the same database transaction that persists the envelope items.

Recipients are matched to placeholder references (`r1`, `r2`, …) by their signing order (ascending), then by database ID as a tiebreaker.

Coordinates are stored as **percentages of page dimensions** so they remain correct regardless of how the PDF is rendered.

**Auto-placement entry point:**
- `packages/trpc/server/envelope-router/create-envelope-items.ts` (lines 158–215)

---

## API — Placeholder positioning

When creating fields via the API you can position a field using a placeholder string instead of explicit coordinates.

**Endpoint:** `POST /envelope/field/create-many`

### Coordinate-based positioning (standard)

```json
{
  "envelopeId": "...",
  "data": [{
    "type": "SIGNATURE",
    "recipientId": 42,
    "page": 1,
    "positionX": 10,
    "positionY": 20,
    "width": 20,
    "height": 5
  }]
}
```

### Placeholder-based positioning

```json
{
  "envelopeId": "...",
  "data": [{
    "type": "SIGNATURE",
    "recipientId": 42,
    "placeholder": "{{sign_here}}",
    "width": 20,
    "height": 5,
    "matchAll": false
  }]
}
```

| Field | Required | Description |
|---|---|---|
| `placeholder` | yes | Text to search for in the PDF. The field is placed at the bounding box of the match. |
| `width` | no | Override the field width (percentage). Defaults to the width of the matched text. |
| `height` | no | Override the field height (percentage). Defaults to the height of the matched text. |
| `matchAll` | no | When `true`, creates one field per occurrence of the placeholder. Defaults to `false` (first occurrence only). |

Both positioning styles can be mixed in a single request.

---

## Key source files

| File | Purpose |
|---|---|
| `packages/lib/server-only/pdf/auto-place-fields.ts` | Core extraction, whiteout, and coordinate-conversion logic |
| `packages/lib/server-only/pdf/helpers.ts` | Parsing helpers — field type, field meta, recipient resolution |
| `packages/lib/server-only/field/create-envelope-fields.ts` | Field creation with placeholder resolution and whiteout via API |
| `packages/trpc/server/envelope-router/create-envelope.ts` | Placeholder extraction on new envelope upload |
| `packages/trpc/server/envelope-router/create-envelope-items.ts` | Placeholder extraction + auto field creation on item upload |
| `packages/trpc/server/envelope-router/envelope-fields/create-envelope-fields.types.ts` | Zod schemas for the create-fields API route |

### Core functions

| Function | File | Description |
|---|---|---|
| `extractPlaceholdersFromPDF` | `auto-place-fields.ts:68` | Scans PDF buffer, returns `PlaceholderInfo[]` with location and parsed metadata |
| `removePlaceholdersFromPDF` | `auto-place-fields.ts:154` | Draws white rectangles over placeholder locations |
| `extractPdfPlaceholders` | `auto-place-fields.ts:190` | Combines extraction + removal; returns `{ cleanedPdf, placeholders }` |
| `convertPlaceholdersToFieldInputs` | `auto-place-fields.ts:210` | Converts `PlaceholderInfo[]` to percentage-based `FieldToCreate[]` |
| `whiteoutRegions` | `auto-place-fields.ts:24` | Low-level helper — draws white rectangles on a loaded PDF object |
| `parseFieldTypeFromPlaceholder` | `helpers.ts:18` | Maps placeholder string → `FieldType` enum |
| `parseFieldMetaFromPlaceholder` | `helpers.ts:45` | Converts raw string key/value pairs to typed field metadata |
| `findRecipientByPlaceholder` | `helpers.ts:116` | Resolves `r1`, `r2`, … to a `Recipient` record |

---

## Coordinate systems

Documenso uses two coordinate origins depending on context:

| Context | Origin | Notes |
|---|---|---|
| PDF (libpdf) | Bottom-left | Standard PDF spec |
| Internal / database | Top-left | All stored field positions |

The conversion is applied in `extractPlaceholdersFromPDF`:

```
topLeftY = pageHeight - bbox.y - bbox.height
```

And reversed when drawing whiteouts (which need bottom-left coordinates back):

```
bottomLeftY = pageHeight - topLeftY - height
```

---

## Recipient resolution

Placeholders without a recipient reference (e.g. `{{name}}`) are **skipped** during auto-placement. They are reserved for future API use where a caller can reference a placeholder by name with optional dimensions.

When recipients are resolved:

- **Auto-placement (upload):** recipients are sorted by `signingOrder` ascending, then by `id` ascending. `r1` maps to index 0, `r2` to index 1, and so on.
- **API (`create-many`):** the caller supplies explicit `recipientId` values; the placeholder string is only used for locating text in the PDF.

If a recipient index is out of range an `INVALID_BODY` error is thrown.

---

## Height fallback

If the detected height of a placeholder is below `0.01` percent of the page height (i.e. effectively invisible text), the field height defaults to **2% of the page height** to ensure it is visible and interactive.
