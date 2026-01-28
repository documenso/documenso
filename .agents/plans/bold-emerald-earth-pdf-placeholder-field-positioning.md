---
date: 2026-01-28
title: Pdf Placeholder Field Positioning
---

## Overview

This feature enables automatic field placement in PDFs using placeholder text, eliminating the need for manual coordinate-based positioning. It supports two complementary workflows:

1. **Automatic detection on upload** - PDFs containing structured placeholders like `{{signature, r1}}` have fields created automatically when uploaded
2. **API placeholder positioning** - Developers can reference any text in a PDF to position fields instead of calculating coordinates

## Goals

- Allow users to prepare documents in Word/Google Docs with placeholders that become signature fields
- Reduce friction for document preparation workflows
- Provide API developers with a simpler alternative to coordinate-based field positioning
- Support documents with repeated placeholders (e.g., initials on every page)

## Placeholder Format (Automatic Detection)

```
{{FIELD_TYPE, RECIPIENT, option1=value1, option2=value2}}
```

### Components

- **FIELD_TYPE** (required): One of `signature`, `free_signature`, `initials`, `name`, `email`, `date`, `text`, `number`, `radio`, `checkbox`, `dropdown`
- **RECIPIENT** (required): `r1`, `r2`, `r3`, etc. - identifies which recipient the field belongs to
- **OPTIONS** (optional): Key-value pairs like `required=true`, `fontSize=14`, `readOnly=true`

### Examples

- `{{signature, r1}}` - Signature field for first recipient
- `{{text, r1, required=true, label=Company Name}}` - Required text field with label
- `{{number, r2, minValue=0, maxValue=100}}` - Number field with validation

### Behavior

- Placeholders without recipient identifiers (e.g., `{{signature}}`) are skipped during automatic detection - reserved for API use
- Invalid field types are silently skipped
- Placeholder text is covered with white rectangles after field creation

## API Placeholder Positioning

The `/api/v2/envelope/field/create-many` endpoint accepts `placeholder` as an alternative to coordinates:

```json
{
  "recipientId": 123,
  "type": "SIGNATURE",
  "placeholder": "{{signature}}"
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `placeholder` | string | Text to search for in the PDF |
| `width` | number | Optional override (percentage) |
| `height` | number | Optional override (percentage) |
| `matchAll` | boolean | When true, creates fields at ALL occurrences |

### matchAll Behavior

- Default (`false`): Only first occurrence gets a field
- `true`: Creates a field at every occurrence of the placeholder text

This is useful for documents requiring initials on every page.

## Implementation Components

### Core Functions

- `extractPlaceholdersFromPDF()` - Scans PDF for `{{...}}` patterns with recipient identifiers
- `removePlaceholdersFromPDF()` - Covers placeholder text with white rectangles
- `whiteoutRegions()` - Low-level helper for drawing white boxes on PDF pages
- `parseFieldTypeFromPlaceholder()` - Converts placeholder field type to FieldType enum
- `parseFieldMetaFromPlaceholder()` - Parses options into fieldMeta format

### Integration Points

1. **Upload flow** (`create-envelope.ts`, `create-envelope-items.ts`)
   - Extract placeholders at upload time (before saving to storage)
   - Pass placeholders in-memory to envelope creation
   - Create placeholder recipients if none provided
   - Create fields within the same transaction

2. **API field creation** (`create-envelope-fields.ts`)
   - Accept `placeholder` as alternative to coordinates
   - Search PDF for placeholder text
   - Resolve position from bounding box
   - Support `matchAll` for multiple occurrences

### Field Meta Parsing

The following properties are explicitly parsed:

- `required`, `readOnly` → boolean
- `fontSize`, `minValue`, `maxValue`, `characterLimit` → number
- Other properties pass through as strings

Note: Signature fields do not support fieldMeta options.

## Testing

### E2E Tests

**UI Tests** (`e2e/auto-placing-fields/`):
- Single recipient placeholder detection
- Multiple recipient placeholder detection
- Field configuration from placeholder options
- Skipping placeholders without recipient identifiers
- Skipping invalid field types

**API Tests** (`e2e/api/v2/placeholder-fields-api.spec.ts`):
- Placeholder-based field positioning
- Width/height overrides
- Error on placeholder not found
- Mixed coordinate and placeholder positioning
- First occurrence only (default)
- All occurrences with `matchAll: true`

## Documentation

### User Documentation

`/users/documents/pdf-placeholders` - Explains:
- Placeholder format and syntax
- Supported field types
- Recipient identifiers
- Available options per field type
- Troubleshooting

### Developer Documentation

`/developers/public-api/reference` - Documents:
- Coordinate-based positioning (existing)
- Placeholder-based positioning (new)
- matchAll parameter
- Mixing both methods

## Edge Cases Handled

1. **No placeholders found** - Original PDF returned unchanged
2. **Placeholder not found (API)** - Returns error with placeholder text
3. **Multiple occurrences** - First only by default, all with `matchAll: true`
4. **No recipient identifier** - Skipped during auto-detection, works for API
5. **Invalid field type** - Skipped during auto-detection
6. **Signature field with options** - Options ignored (signature doesn't support fieldMeta)

## Future Considerations

- Support for placeholder text styles (bold, underline) to indicate field properties
- Template-level placeholder mapping for reusable configurations
- Placeholder validation in document editor before sending