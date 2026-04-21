# Conditional Field Visibility — Design

**Status:** Approved; awaiting implementation plan.
**Author:** Aziz Khoury
**Date:** 2026-04-21
**Scope:** Documenso fork (Doctor's Choice).

## Summary

Let a template author make one field's visibility depend on another field's value. When a template is edited, the author picks a dependent field (e.g. "Spouse name"), adds one or more rules referencing other same-recipient fields (e.g. "Marital status equals Married"), and the dependent field shows or hides at signing time based on committed trigger values. The feature is scoped to same-recipient dependencies and piggybacks on the existing `fieldMeta` JSON column — no database migration required.

## Goals

- Template authors can build branching forms without duplicating templates per branch.
- Hidden fields are correctly excluded from the signed PDF, required-field checks, webhook payloads, and final field values.
- A signer's visibility state re-evaluates live as they commit trigger values.
- An auditor can reconstruct *why* a field was not signed from the document audit log and signing certificate.
- Zero DB migration. Zero breaking API change for consumers that don't use the feature.

## Non-goals

- Cross-recipient visibility (the data model does not support it; no runtime state bridges recipients).
- Hiding signature / initials / name / email / date / free-signature fields (legal/auditability risk).
- Nested boolean groups or full expression trees — flat rule list with a single ALL/ANY join.
- Number and date fields as triggers — excluded to keep operator surface small; revisitable.
- Regex or case-sensitive matching on text triggers.
- Per-keystroke live visibility updates — re-evaluation runs on committed values only.

## Terminology

- **Trigger field** — the field whose value is being tested (field0 in the user's framing).
- **Dependent field** — the field whose visibility depends on trigger(s) (field1).
- **Rule** — `{ triggerFieldStableId, operator, value? }`.
- **Visibility block** — `{ match: 'all' | 'any', rules: Rule[] }` attached to a dependent's `fieldMeta`.
- **Stable ID** — a short cuid2 inside `fieldMeta` that survives template→document copy, used for rule references.

---

## 1. Data model & storage

The visibility rule is stored in `Field.fieldMeta` (an existing `Json?` column on the `Field` table), not in a new column or table.

### 1.1 Why JSON, not a new column or table

- `fieldMeta` already flows unchanged through template→document copy (`packages/lib/server-only/template/create-document-from-template.ts:664-681`) and envelope duplication (`packages/lib/server-only/envelope/duplicate-envelope.ts:201`). New columns or tables would require explicit copy logic in at least three places.
- Zero Prisma migration.
- Downside: no SQL-level relational integrity between a dependent's rule and its trigger. Acceptable — we never need "find all fields that reference field X" as a SQL query.

### 1.2 Schema extension

In `packages/lib/types/field-meta.ts`, extend `ZBaseFieldMeta` with two optional additions:

```ts
stableId?: string;       // cuid2, generated server-side on demand
visibility?: {
  match: 'all' | 'any';
  rules: Array<
    | { operator: 'equals' | 'notEquals' | 'contains' | 'notContains';
        triggerFieldStableId: string;
        value: string }
    | { operator: 'isEmpty' | 'isNotEmpty';
        triggerFieldStableId: string }
  >;
}
```

Constraints:

- `visibility` is admitted into the zod schema **only** for dependent-eligible types: `TEXT, NUMBER, RADIO, CHECKBOX, DROPDOWN`. The zod schemas for `SIGNATURE, FREE_SIGNATURE, INITIALS, NAME, EMAIL, DATE` do not include `visibility`; payloads containing it are rejected.
- `visibility.rules` has `.min(1).max(10)`. An empty block is invalid — if the editor removes the last rule, it must strip `visibility` entirely.
- `stableId` is optional at rest but materialized lazily (see §5.4). Once assigned it is immutable.

### 1.3 The stable-identifier problem

`Field.secondaryId` is `@unique @default(cuid())`. The template→document copy code (`create-document-from-template.ts:614`) uses `Omit<Field, 'id' | 'secondaryId'>`, which regenerates `secondaryId` on the new row. This is correct for Documenso's existing model, where `secondaryId` identifies a specific row, not a logical field-across-copies.

Because of this, a visibility rule cannot reference a trigger by `id` or `secondaryId` — both change on copy. We introduce `stableId` inside `fieldMeta`, which is copied verbatim by the existing copy logic and therefore survives.

### 1.4 `stableId` properties

- Scope: unique within an envelope. No global uniqueness requirement.
- Assigned lazily: only fields that are either a dependent (have a `visibility` block) or a trigger (are referenced by another field's rule) receive one. Fields with no relation to the feature never get a `stableId`, avoiding a backfill migration.
- Immutable once assigned. If a subsequent update payload contains a different `stableId` for the same field, the server silently keeps the original.

---

## 2. Evaluation engine

A single evaluator lives at `packages/lib/universal/field-visibility/`. It is imported by both client and server code. No framework coupling.

### 2.1 API

```ts
evaluateVisibility(field: Field, siblings: Field[]): { visible: boolean }
evaluateAllVisibility(fields: Field[]): Map<stableId, boolean>
```

`evaluateAllVisibility` is the primary entry point. It accepts all same-recipient fields and returns a visibility map.

### 2.2 Algorithm

- Build the dependency graph: edge from dependent to each trigger it references.
- Topologically sort. Cycles are impossible at runtime because they are rejected at save time (§5.3). If a cycle is somehow present (data corruption), fail-closed — every field in the cycle evaluates to hidden.
- Single pass in topological order: for each field, evaluate its rules against already-resolved trigger values.
- Missing / deleted trigger → rule evaluates `false` (fail-closed).
- Fields without a `visibility` block always evaluate `visible: true`.

### 2.3 Operator semantics

| Operator | Checkbox | Radio | Dropdown | Text |
|---|---|---|---|---|
| `equals` | — | ✓ | ✓ | ✓ (case-insensitive, trimmed) |
| `notEquals` | — | ✓ | ✓ | ✓ (case-insensitive, trimmed) |
| `contains` | ✓ (membership) | — | — | ✓ (case-insensitive, trimmed substring) |
| `notContains` | ✓ | — | — | — |
| `isEmpty` | ✓ | ✓ | ✓ | ✓ |
| `isNotEmpty` | ✓ | ✓ | ✓ | ✓ |

For checkbox `contains`, the `value` is a single checkbox option value; "contains" means that option is checked in the trigger's current value. To require multiple checkboxes, the user adds multiple rules.

For text, comparison normalizes both sides: `trim()` then `toLowerCase()`.

### 2.4 Client-side runtime

- `EnvelopeSigningProvider` (`apps/remix/app/components/general/document-signing/envelope-signing-provider.tsx`) holds the recipient's fields in context.
- Add a `useMemo` that runs `evaluateAllVisibility` whenever `recipient.fields` changes and exposes a `Map<stableId, boolean>` via the same context.
- `FieldRootContainer` (`packages/ui/components/field/field.tsx`) consumes the map via a new `useFieldVisibility(field)` hook and returns `null` early when hidden. Fields are absolutely-positioned portals over the PDF; hiding does not reflow document layout.
- Re-evaluation runs on **committed values only** (values persisted via `envelope.field.sign`), not on every keystroke. Radio/checkbox/dropdown clicks commit immediately, so they feel instant. Text triggers update visibility on blur/save, not per-keystroke. This is deliberate — it stops dependent fields from flickering mid-typing.

### 2.5 Server-side enforcement

- `envelope.field.sign` re-runs the evaluator server-side against the persisted state and rejects writes to hidden fields with `FIELD_NOT_VISIBLE`. Protects against tampered clients and race conditions.
- At signing completion, before the PDF is sealed, the server runs `evaluateAllVisibility` across the recipient's fields. For every field that evaluates hidden:
  - `customText` is cleared.
  - The required-field check is skipped.
  - The field is excluded from the rendered PDF output.
  - The field is excluded from the final field-values payload.
  - An audit-log entry `FIELD_SKIPPED_CONDITIONAL` is emitted (§7.1).

### 2.6 Runtime value clearing

When a trigger change flips a dependent from visible to hidden mid-session, the client optimistically clears the dependent's local value and fires `envelope.field.sign` with empty `customText`. If the server rejects (e.g., the field was already signed and some state transition blocks the clear), the completion-time sweep in §2.5 is the safety net.

---

## 3. Template editor UX

### 3.1 Placement

The visibility rule UI lives as a new inline section at the bottom of the existing per-field advanced-settings sidebar (`packages/ui/primitives/document-flow/field-item-advanced-settings.tsx`). Same sidebar that already contains Label, Required, Placeholder, Font size. The section is rendered only for dependent-eligible types.

### 3.2 Trigger-field picker

A dropdown that lists eligible trigger fields:

- Filtered to the **same recipient** as the dependent.
- Filtered to eligible trigger types: `RADIO, CHECKBOX, DROPDOWN, TEXT`.
- Excludes the dependent itself.
- Excludes any field that would create a cycle if picked.
- Each option displayed as `{Label} · {Type} · p.{PageNumber}`.
- Unlabeled fields fall back to `Unnamed {Type} #{index-within-type}` in italic, hinting the author should add a label.

### 3.3 Operator picker

Rendered contextually based on the picked trigger's type. See §2.3 for the operator-by-type matrix.

### 3.4 Value picker

Rendered based on trigger type + operator:

- Radio / Dropdown with `equals` / `notEquals`: `<select>` populated from the trigger's `fieldMeta.values`.
- Checkbox with `contains` / `notContains`: `<select>` populated from the trigger's defined values (single pick; multiple options → multiple rules).
- Text with `equals` / `notEquals` / `contains`: free text input, with a muted note below it: *"Matches case-insensitively, ignoring leading/trailing whitespace."*
- `isEmpty` / `isNotEmpty`: no value input rendered.

### 3.5 Rule list and match mode

- Flat list of rows; each row is `[trigger] [operator] [value] [remove]`.
- A `+ Add rule` button below the list.
- When the list has ≥ 2 rules, a two-segment toggle appears above: `Match ALL` / `Match ANY`. Defaults to `ALL`. Hidden when the list has 0 or 1 rule.
- No drag-reorder. Rules are commutative under both ALL and ANY.

### 3.6 Canvas indicator

A small glyph (lucide `Eye` or `GitBranch`) overlays the top-right corner of any field on the PDF canvas that has a visibility rule. Hover tooltip summarizes the rules in plain English, e.g. *"Shown when: Marital status equals Married AND Has children is not empty."*

### 3.7 Live editor validation

Runs on change and on save. Each violation surfaces an inline error on the offending rule row and blocks save until resolved. See §5.2 for the validation set.

### 3.8 Explicitly out of scope for v1

- "Test this rule" preview inside the editor.
- Nested rule groups.
- Drag-reorder of rules.

---

## 4. Signing-time UX

### 4.1 Visual transitions

Fields fade in/out via a 150ms CSS opacity/scale transition on `FieldRootContainer`. No transition on initial load (avoids a flash of all fields materializing).

### 4.2 Value clearing

When a filled dependent becomes hidden, its value is cleared server-side immediately and the UI removes the field. No confirmation dialog, no toast, no undo. If the condition is re-triggered later, the field returns empty.

### 4.3 Progress indicators

Documenso's "X of Y fields to sign" counter uses **currently-visible required fields** for `Y`. A dependent being revealed increases `Y`; being hidden decreases both `Y` and (if it was signed) `X`.

### 4.4 Auto-advance

The "next field" navigation skips hidden fields. A newly revealed field slots into traversal order at its PDF position. If a new required field is revealed after the signer reached the "ready to complete" state, the UI returns to the signing state with a subtle toast: *"A new required field was revealed. Please complete it to continue."*

### 4.5 Already-signed dependent that becomes hidden

The field disappears from the canvas, its value clears server-side, progress updates. No dialog.

### 4.6 Server-rejected sign

If the client attempts to sign a hidden field, the server returns `FIELD_NOT_VISIBLE`. The client shows an inline neutral error on the field (*"This field is not currently active."*) and refreshes visibility state from the server.

### 4.7 Accessibility

- Hidden fields: `aria-hidden="true"` and removed from tab order.
- Field reveal: announced via an `aria-live="polite"` region, e.g. *"Field revealed: {label}"*.

---

## 5. Validation & cycle detection

### 5.1 Zod-level validation

Lives in `packages/lib/types/field-meta.ts`. Enforces:

- `visibility` only on dependent-eligible types (discriminated union).
- `visibility.rules` is `.min(1).max(10)`.
- Rules are a discriminated union on `operator` — value-requiring operators demand a `value`; `isEmpty` / `isNotEmpty` forbid it.
- `triggerFieldStableId` is a non-empty string.

### 5.2 Cross-field validation

Runs in the tRPC handlers for `envelope.field.createMany`, `updateMany`, `set`, `delete`, against the envelope's complete field set (after merging the payload):

1. **Trigger exists** — `triggerFieldStableId` resolves to a field in the same envelope. Error: `FIELD_VISIBILITY_TRIGGER_NOT_FOUND`.
2. **Same recipient** — trigger's `recipientId` equals dependent's `recipientId`. Error: `FIELD_VISIBILITY_CROSS_RECIPIENT`.
3. **Trigger type eligible** — trigger is `RADIO / CHECKBOX / DROPDOWN / TEXT`. Error: `FIELD_VISIBILITY_TRIGGER_INELIGIBLE`.
4. **Value valid for trigger** — for radio/checkbox/dropdown, the rule's `value` matches one of the trigger's `fieldMeta.values`. Error: `FIELD_VISIBILITY_VALUE_INVALID`.
5. **No self-reference** — dependent's `stableId` ≠ any `triggerFieldStableId` in its own rules. Error: `FIELD_VISIBILITY_SELF_REFERENCE`.
6. **No cycle** — §5.3. Error: `FIELD_VISIBILITY_CYCLE` (includes the cycle path).

Each error carries `{ fieldId, ruleIndex, code, message }` so the editor UI highlights the offending row.

### 5.3 Cycle detection

DFS with visiting / visited sets:

```
for each field F with visibility rules:
  dfs(F, visiting={})

dfs(node, visiting):
  if node in visiting: report cycle (path)
  if node already fully visited: return
  visiting.add(node)
  for each rule in node.visibility.rules:
    dfs(trigger of rule, visiting)
  visiting.remove(node); mark visited
```

O(V+E) on the envelope's field graph. Runs only at tRPC save time — never at runtime.

### 5.4 `stableId` lifecycle

- Assigned lazily in the tRPC handler when a field is saved that either has a `visibility` block or is referenced as a trigger by another field in the same save batch.
- Once assigned, immutable. Incoming payloads with a different `stableId` for the same field are silently normalized to the stored value.
- Format: cuid2, ~10 chars.
- No cross-envelope uniqueness required.

### 5.5 Bulk endpoints

`createMany`, `updateMany`, `set` run validation against the post-merge envelope state, so rules can reference fields created in the same batch.

### 5.6 Delete with dangling references

`envelope.field.delete` rejects deletion of a field that is referenced as a trigger by another field's rule, unless the caller passes a `force: true` flag. When forced, the handler strips the dangling rules from the referring fields atomically in the same transaction.

### 5.7 Template → document copy

No validation re-run needed. `fieldMeta` copies verbatim; `stableId`s ride along; rules continue to resolve. The copy is only capable of producing invalid state if the template's validation was bypassed, which would be a Documenso bug independent of this feature.

---

## 6. API surface

### 6.1 No new endpoints

All changes are additive schema extensions to existing endpoints. Consumers that do not use the feature see no impact.

### 6.2 Affected tRPC endpoints (`packages/trpc/server/envelope-router/`)

| Endpoint | Change |
|---|---|
| `envelope.field.createMany` | Accepts `fieldMeta.visibility`. Server assigns `stableId` lazily. |
| `envelope.field.updateMany` | Accepts `fieldMeta.visibility`. Preserves existing `stableId`. |
| `envelope.field.set` | Accepts `fieldMeta.visibility` across the batch; cross-field validation runs against post-merge state. |
| `envelope.field.get` | Response includes `fieldMeta.visibility` and `fieldMeta.stableId` when present. |
| `envelope.field.sign` | New runtime check: rejects writes to hidden fields with `FIELD_NOT_VISIBLE`. |
| `envelope.field.delete` | Rejects if referenced as a trigger, unless `force: true`. With `force`, strips dangling rules. |

### 6.3 Signer-facing payload

The envelope-load tRPC call already returns all fields for the current recipient. It gains `fieldMeta.visibility` and `fieldMeta.stableId` in the same payload shape — the client already has everything needed to run the evaluator locally.

### 6.4 Webhook payloads

- Hidden-at-completion fields are excluded from the `field values` array on `document.signed` / `document.completed` webhooks.
- Audit-log entries (`FIELD_SKIPPED_CONDITIONAL`) are still emitted and fetchable via the existing audit-log endpoints.
- No new webhook topic for conditional skips (would be noisy).

### 6.5 REST v1 (`packages/api`)

The v1 ts-rest contracts accept `fieldMeta` as freeform JSON today. We wire the same zod validator into the v1 handlers so v1 users get the same constraints. Contract docs gain an additive note about the optional `visibility` block. Existing payloads continue to work unchanged.

### 6.6 OpenAPI and SDKs

Schema additions propagate to the tRPC-generated OpenAPI spec automatically. Typed SDKs regenerated against the schemas pick up the new shape on next regen.

### 6.7 New error codes

- `FIELD_VISIBILITY_TRIGGER_NOT_FOUND`
- `FIELD_VISIBILITY_TRIGGER_INELIGIBLE`
- `FIELD_VISIBILITY_CROSS_RECIPIENT`
- `FIELD_VISIBILITY_VALUE_INVALID`
- `FIELD_VISIBILITY_CYCLE` (with cycle path in the payload)
- `FIELD_VISIBILITY_SELF_REFERENCE`
- `FIELD_NOT_VISIBLE` (runtime, from `field.sign`)

---

## 7. Audit trail & compliance

### 7.1 New audit-log event types

Emitted to the existing document audit-log system. Event types added to the existing enum:

| Event | When | Payload |
|---|---|---|
| `FIELD_VALUE_CLEARED_CONDITIONAL` | A filled dependent becomes hidden mid-session. | `{ fieldId, stableId, previousValue, triggerChange: { triggerStableId, oldValue, newValue } }` |
| `FIELD_SKIPPED_CONDITIONAL` | At signing completion, per hidden field. | `{ fieldId, stableId, fieldLabel, unmetRuleSummary }` |
| `FIELD_VISIBILITY_RULE_ADDED` | Editor adds a rule (documents only). | `{ fieldId, ruleSnapshot }` |
| `FIELD_VISIBILITY_RULE_REMOVED` | Editor removes a rule (documents only). | `{ fieldId, ruleSnapshot }` |
| `FIELD_VISIBILITY_RULE_MODIFIED` | Editor modifies a rule (documents only). | `{ fieldId, before, after }` |

Editor-side events are emitted on documents only, not templates, matching Documenso's existing convention.

### 7.2 Signing certificate

The appended signing certificate gains a per-recipient section listing any fields skipped due to unmet visibility conditions:

> **Fields not signed due to conditional visibility:**
> - *Spouse name* — not shown because *Marital status* was *Single*.
> - *Dependents detail* — not shown because *Has children* was not set.

This is the auditable answer to "why is this template field not signed?" Without it, skipped fields would be silently absent.

### 7.3 Data retention

Cleared field values and previous trigger values are preserved in the audit log (they contain PII in some cases). Retention follows Documenso's existing document audit-log retention policy. If future compliance requires redaction of cleared values, that is a follow-up — not blocking v1.

### 7.4 Legal / e-signature laws

eIDAS, UETA, and ESIGN do not regulate whether unused form fields appear on the final document. Conditional fields are legally equivalent to fields that were never placed. What regulators require is an audit trail; this design provides a comprehensive one.

### 7.5 Explicitly out of scope for v1

- Signer-facing visibility history widget.
- Dedicated webhook topic for skips.

---

## Implementation anchors

Key file paths the implementation will touch:

- `packages/prisma/schema.prisma` — no schema change; the `Field.fieldMeta` JSON column already accepts the new shape.
- `packages/lib/types/field-meta.ts` — extend `ZBaseFieldMeta`; add `ZVisibilityRule`, `ZVisibilityBlock`; wire into the dependent-eligible discriminated union branches.
- `packages/lib/universal/field-visibility/` — new directory: evaluator, topological sort, operator semantics, unit tests.
- `packages/lib/server-only/envelope/validate-field-visibility.ts` — new: cross-field validator invoked by tRPC handlers.
- `packages/trpc/server/envelope-router/envelope-fields/` — wire the validator into `createMany`, `updateMany`, `set`, `delete`. Runtime check in `sign`.
- `packages/lib/server-only/envelope/seal-envelope.ts` (or wherever completion runs) — completion-time sweep that clears hidden fields, skips required checks, emits `FIELD_SKIPPED_CONDITIONAL`.
- `packages/lib/server-only/document-audit-logs/` — register new event types and i18n strings.
- `packages/ui/primitives/document-flow/field-item-advanced-settings.tsx` — mount the visibility section; individual per-type panels (`text-field.tsx`, `radio-field.tsx`, etc.) render it.
- `packages/ui/components/field/field.tsx` — `FieldRootContainer` consumes `useFieldVisibility` and returns `null` when hidden; canvas indicator glyph.
- `apps/remix/app/components/general/document-signing/envelope-signing-provider.tsx` — visibility map `useMemo`; expose `useFieldVisibility` hook.
- `apps/remix/app/components/general/document-signing/*` — progress counter adjustment; auto-advance handling; `aria-live` reveal announcements; signing-certificate rendering.
- `packages/api/` — wire the zod validator into REST v1 field handlers.

Tests:

- Unit: `packages/lib/universal/field-visibility/*.test.ts` (evaluator, operator semantics, cycle detection).
- Unit: server-only validator test covering all error codes.
- E2E (Playwright, `packages/app-tests/e2e/`): template editor flow (build a conditional template, sign it, verify hidden-field exclusion), signing-certificate content.

## Open questions

None blocking. Deferred follow-ups noted as "out of scope" throughout.
