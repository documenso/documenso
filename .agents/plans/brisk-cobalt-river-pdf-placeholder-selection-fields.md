---
date: 2026-05-07
title: Pdf Placeholder Selection Fields
---

## Summary

Extend PDF placeholders so radio and dropdown fields can be configured from the existing Documenso placeholder syntax:

```text
{{FIELD_TYPE, RECIPIENT, key=value, key=value}}
```

Do not introduce a new delimiter style. Existing applications may already generate placeholders in this format, so the new selection-field behavior should fit into it.

## Goals

- Keep the current placeholder grammar unchanged.
- Support radio placeholders with option lists, default/preselected values, direction, label, required, read-only, and font size.
- Support dropdown placeholders with option lists, placeholder text, default value, label, required, read-only, and font size.
- Use `options` as the only public list key in PDF placeholders.
- Convert `options` into internal `fieldMeta.values` during parsing.
- Make generated fields usable immediately in the editor, signing UI, preview renderer, and final PDF export.

## Non-Goals

- No semicolon placeholder syntax.
- No `values` alias in PDF placeholder syntax.
- No database migration.
- No behavior change for existing placeholders such as `{{text, r1, required=true}}`.

## Placeholder Syntax

Use the existing comma-separated placeholder format:

```text
{{radio, r1, label=Payment method, options=Card|Bank transfer|Check, defaultValue=Check}}
{{radio, r1, label=Plan, options=Basic|Pro|Enterprise, selected=Pro, direction=horizontal}}
{{dropdown, r1, label=Country, placeholder=Select country, options=United States|Canada|United Kingdom}}
{{dropdown, r2, label=Department, placeholder=Choose department, options=Sales|Legal|Finance, defaultValue=Legal}}
```

Use `|` inside `options` because `,` is already the top-level placeholder delimiter.

Parsing rules:

- Split top-level placeholder tokens on unescaped commas.
- Split metadata tokens on the first unescaped equals sign.
- Split `options` on unescaped pipes.
- Trim option values and drop empty values.
- Preserve option order.
- Support escaped delimiters: `\,`, `\=`, and `\|`.
- Treat field type values case-insensitively.

## Field Type Mapping

- `radio` maps to `FieldType.RADIO`.
- `dropdown` maps to `FieldType.DROPDOWN`.

## Metadata Mapping

### Radio

Example:

```text
{{radio, r1, label=Payment method, options=Card|Bank transfer|Check, selected=Bank transfer}}
```

Normalize to:

```ts
{
  type: FieldType.RADIO,
  fieldMeta: {
    type: 'radio',
    label: 'Payment method',
    values: [
      { id: 1, value: 'Card', checked: false },
      { id: 2, value: 'Bank transfer', checked: true },
      { id: 3, value: 'Check', checked: false },
    ],
  },
}
```

Accepted keys:

- `label`
- `placeholder` as an empty-state fallback only
- `options`
- `selected`, `default`, or `defaultValue`
- `direction=vertical|horizontal`
- `required=true|false`
- `readOnly=true|false`
- `fontSize=12`

Radio fields do not have a conventional placeholder once options exist. Use `label` as the visible prompt; treat `placeholder` only as a fallback when no options are configured.

### Dropdown

Example:

```text
{{dropdown, r1, label=Department, placeholder=Choose department, options=Sales|Legal|Finance, defaultValue=Legal}}
```

Normalize to:

```ts
{
  type: FieldType.DROPDOWN,
  fieldMeta: {
    type: 'dropdown',
    label: 'Department',
    placeholder: 'Choose department',
    values: [{ value: 'Sales' }, { value: 'Legal' }, { value: 'Finance' }],
    defaultValue: 'Legal',
  },
}
```

Accepted keys:

- `label`
- `placeholder`
- `options`
- `selected`, `default`, or `defaultValue`
- `required=true|false`
- `readOnly=true|false`
- `fontSize=12`

`defaultValue` should only be set if it matches one parsed option.

## Code Touchpoints

- `packages/lib/server-only/pdf/helpers.ts`
  - Extend `parseFieldMetaFromPlaceholder` so `options` normalizes into radio/dropdown `fieldMeta.values`.
  - Add delimiter-aware helpers for commas, equals signs, and pipes.
- `packages/lib/server-only/pdf/auto-place-fields.ts`
  - Replace plain comma splitting with delimiter-aware splitting.
  - Preserve the existing positional structure: field type, recipient, metadata.
- `packages/lib/types/field-meta.ts`
  - Keep current internal schemas: radio/dropdown still store options as `fieldMeta.values`.
- `packages/ui/primitives/document-flow/field-content.tsx`
  - Display dropdown `fieldMeta.placeholder || Select` before insertion.
  - Display a radio fallback when a placeholder-created radio has no options.
- `packages/lib/universal/field-renderer/render-dropdown-field.ts`
  - Use dropdown placeholder text in edit/sign modes when no selected/default value exists.
- `apps/remix/app/components/general/document-signing/document-signing-dropdown-field.tsx`
  - Use parsed dropdown placeholder text in `SelectValue`.
- `apps/remix/app/components/dialogs/sign-field-dropdown-dialog.tsx`
  - Use the same placeholder text for the command input.
- Docs:
  - `apps/docs/content/docs/users/documents/advanced/pdf-placeholders.mdx`
  - `apps/docs/content/docs/developers/api/fields.mdx`

## Test Plan

Unit tests:

- `options=Yes|No|Maybe` becomes stable radio values.
- `selected=No` marks only the matching radio option checked.
- Dropdown `placeholder`, `options`, and `defaultValue` normalize correctly.
- Escaped delimiters parse correctly, for example `options=Sales\|Ops|Legal\, Compliance|A\=B`.

E2E/API tests:

- Add a PDF fixture with radio and dropdown placeholders using the current syntax.
- Verify created fields have schema-compatible metadata and expected options/defaults.
- Verify dropdown placeholder text appears before signing.

Suggested verification:

```bash
npm run test -w @documenso/lib -- server-only/pdf/helpers.test.ts
npm run test:dev -w @documenso/app-tests -- e2e/auto-placing-fields/auto-place-fields-document.spec.ts
npm run test:dev -w @documenso/app-tests -- e2e/envelope-editor-v2/envelope-fields.spec.ts
npx tsc --noEmit -p packages/lib/tsconfig.json
npx tsc --noEmit -p apps/remix/tsconfig.json
```

Do not use `npm run build` for routine verification unless explicitly requested.

## Decisions

- Keep the existing placeholder format.
- Use only `options` publicly.
- Keep `values` as an internal metadata field only.
- Use `|` as the option delimiter inside `options`.
