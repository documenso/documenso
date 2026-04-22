# Conditional Field Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement same-recipient conditional field visibility in templates and documents: a dependent field shows only when one or more trigger fields (radio/checkbox/dropdown/text) satisfy their rules; at signing time, hidden fields are excluded from required checks, the signed PDF, webhooks, and final values; audit log captures every skip.

**Architecture:** Visibility data lives entirely in the existing `Field.fieldMeta` JSON column — no Prisma migration. A new `stableId` (cuid2) inside `fieldMeta` survives template→document copy. A shared universal evaluator computes visibility client- and server-side from the current same-recipient field set. Server re-validates visibility on every `field.sign` and sweeps at document completion. Editor UI lives as an inline section in the existing per-field advanced-settings sidebar.

**Tech Stack:** TypeScript, Zod (schemas), Prisma (ORM, no migration), tRPC (validation at input), Vitest (unit tests), Playwright (e2e), React/React Router v7 (client), shadcn/Radix/Tailwind (UI), `@paralleldrive/cuid2` (stableId generation — already in the repo transitively via Prisma).

---

## Spec reference

This plan implements `docs/superpowers/specs/2026-04-21-conditional-fields-design.md`. Every task traces back to a section in that spec.

## File structure

Created:
- `packages/lib/universal/field-visibility/evaluate.ts` — pure evaluator.
- `packages/lib/universal/field-visibility/evaluate.test.ts`
- `packages/lib/universal/field-visibility/topological-sort.ts`
- `packages/lib/universal/field-visibility/topological-sort.test.ts`
- `packages/lib/universal/field-visibility/index.ts` — barrel export.
- `packages/lib/server-only/envelope/validate-field-visibility.ts` — cross-field validator + cycle detection.
- `packages/lib/server-only/envelope/validate-field-visibility.test.ts`
- `packages/ui/primitives/document-flow/field-items-advanced-settings/visibility-section.tsx` — reusable visibility UI.
- `packages/ui/components/field/use-field-visibility.ts` — client hook.
- `apps/remix/app/components/general/document-signing/__tests__/visibility-progress.test.tsx` (optional; prefer e2e)
- `packages/app-tests/e2e/templates/conditional-field-visibility.spec.ts` — end-to-end.

Modified:
- `packages/lib/types/field-meta.ts` — add `stableId`, `visibility`, and per-type flag.
- `packages/lib/utils/advanced-fields-helpers.ts` — visibility-aware required helper.
- `packages/lib/server-only/field/create-envelope-fields.ts` — invoke validator, assign stableIds.
- `packages/lib/server-only/field/update-envelope-fields.ts` — same.
- `packages/lib/server-only/field/set-fields-for-document.ts` — same.
- `packages/lib/server-only/field/set-fields-for-template.ts` — same.
- `packages/lib/server-only/field/sign-field-with-token.ts` — runtime FIELD_NOT_VISIBLE check.
- `packages/lib/server-only/field/delete-document-field.ts` — reject if referenced; `force` to strip.
- `packages/lib/server-only/field/delete-template-field.ts` — same.
- `packages/lib/server-only/document/complete-document-with-token.ts` — completion sweep + audit events.
- `packages/lib/types/document-audit-logs.ts` — three new enum values.
- `packages/lib/utils/document-audit-logs.ts` — data shapes for the new events.
- `packages/trpc/server/envelope-router/envelope-fields/create-envelope-fields.ts` — surface new error codes.
- `packages/trpc/server/envelope-router/envelope-fields/update-envelope-fields.ts` — same.
- `packages/trpc/server/envelope-router/envelope-fields/delete-envelope-field.ts` — accept `force`.
- `packages/trpc/server/envelope-router/envelope-fields/delete-envelope-field.types.ts` — accept `force`.
- `packages/errors/app-error.ts` (or wherever `AppErrorCode` lives) — register new codes.
- `packages/ui/primitives/document-flow/field-items-advanced-settings/text-field.tsx` — mount `<VisibilitySection>`.
- `packages/ui/primitives/document-flow/field-items-advanced-settings/number-field.tsx` — same.
- `packages/ui/primitives/document-flow/field-items-advanced-settings/radio-field.tsx` — same.
- `packages/ui/primitives/document-flow/field-items-advanced-settings/checkbox-field.tsx` — same.
- `packages/ui/primitives/document-flow/field-items-advanced-settings/dropdown-field.tsx` — same.
- `packages/ui/components/field/field.tsx` — hide hidden fields; canvas indicator overlay.
- `apps/remix/app/components/general/document-signing/envelope-signing-provider.tsx` — visibility map + `visibleRecipientFields` + required filter.
- `packages/lib/server-only/template/create-document-from-template.ts` — audit that prefill preserves `stableId`/`visibility` on `getUpdatedFieldMeta`.
- `packages/lib/utils/webhook-payload.ts` (or wherever field values are serialized for webhooks) — filter hidden fields.
- Signing certificate renderer (located during Task 17).

---

## Testing conventions

Unit tests use **Vitest** (config at `packages/lib/vitest.config.ts`, include pattern `**/*.test.ts`). Run from the relevant package directory:

```bash
cd packages/lib && npm run test -- <path-substring>
```

End-to-end tests use **Playwright** at `packages/app-tests/`. Run:

```bash
cd packages/app-tests && npm run test:e2e -- <spec-file>
```

---

## Tasks

### Task 1: Extend `fieldMeta` zod schema with `stableId` and `visibility`

**Spec:** §1.2 (schema), §5.1 (zod validation), §2.3 (operators).

**Files:**
- Modify: `packages/lib/types/field-meta.ts`
- Test: `packages/lib/types/field-meta.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/lib/types/field-meta.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  ZCheckboxFieldMeta,
  ZDateFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZSignatureFieldMeta,
  ZTextFieldMeta,
  ZVisibilityBlock,
} from './field-meta';

describe('field-meta visibility extension', () => {
  const validBlock = {
    match: 'all' as const,
    rules: [
      { operator: 'equals' as const, triggerFieldStableId: 'abc', value: 'Married' },
    ],
  };

  it('accepts stableId and visibility on text fields', () => {
    const parsed = ZTextFieldMeta.parse({
      type: 'text',
      stableId: 'xyz',
      visibility: validBlock,
    });
    expect(parsed.visibility).toEqual(validBlock);
    expect(parsed.stableId).toBe('xyz');
  });

  it.each([
    ['number', ZNumberFieldMeta],
    ['radio', ZRadioFieldMeta],
    ['checkbox', ZCheckboxFieldMeta],
    ['dropdown', ZDropdownFieldMeta],
  ])('accepts visibility on %s fields', (type, schema) => {
    expect(() =>
      schema.parse({ type, stableId: 'id1', visibility: validBlock }),
    ).not.toThrow();
  });

  it('rejects visibility on signature fields', () => {
    expect(() =>
      ZSignatureFieldMeta.parse({
        type: 'signature',
        visibility: validBlock,
      }),
    ).toThrow();
  });

  it('rejects visibility on date fields', () => {
    expect(() =>
      ZDateFieldMeta.parse({
        type: 'date',
        visibility: validBlock,
      }),
    ).toThrow();
  });

  it('requires value when operator is equals', () => {
    expect(() =>
      ZVisibilityBlock.parse({
        match: 'all',
        rules: [{ operator: 'equals', triggerFieldStableId: 'abc' }],
      }),
    ).toThrow();
  });

  it('rejects value when operator is isEmpty', () => {
    expect(() =>
      ZVisibilityBlock.parse({
        match: 'all',
        rules: [
          { operator: 'isEmpty', triggerFieldStableId: 'abc', value: 'x' },
        ],
      }),
    ).toThrow();
  });

  it('requires at least one rule', () => {
    expect(() => ZVisibilityBlock.parse({ match: 'all', rules: [] })).toThrow();
  });

  it('rejects more than 10 rules', () => {
    const rules = Array.from({ length: 11 }, (_, i) => ({
      operator: 'equals' as const,
      triggerFieldStableId: `t${i}`,
      value: 'v',
    }));
    expect(() => ZVisibilityBlock.parse({ match: 'all', rules })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/lib && npm run test -- field-meta.test
```

Expected: FAIL (imports `ZVisibilityBlock`, `stableId`, `visibility` that don't exist yet).

- [ ] **Step 3: Extend the schema**

In `packages/lib/types/field-meta.ts`, add above `ZBaseFieldMeta`:

```ts
export const ZVisibilityRule = z.discriminatedUnion('operator', [
  z.object({
    operator: z.enum(['equals', 'notEquals', 'contains', 'notContains']),
    triggerFieldStableId: z.string().min(1),
    value: z.string(),
  }),
  z.object({
    operator: z.enum(['isEmpty', 'isNotEmpty']),
    triggerFieldStableId: z.string().min(1),
  }),
]);

export type TVisibilityRule = z.infer<typeof ZVisibilityRule>;

export const ZVisibilityBlock = z.object({
  match: z.enum(['all', 'any']),
  rules: z.array(ZVisibilityRule).min(1).max(10),
});

export type TVisibilityBlock = z.infer<typeof ZVisibilityBlock>;

const ZConditionalMetaExtensions = {
  stableId: z.string().optional(),
  visibility: ZVisibilityBlock.optional(),
};
```

Then, change each dependent-eligible meta schema to spread `ZConditionalMetaExtensions`. For each of `ZTextFieldMeta`, `ZNumberFieldMeta`, `ZRadioFieldMeta`, `ZCheckboxFieldMeta`, `ZDropdownFieldMeta`, change the `.extend({ ... })` to include the conditional keys. Example for `ZTextFieldMeta`:

```ts
export const ZTextFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('text'),
  text: z.string().optional(),
  characterLimit: z.coerce.number({ invalid_type_error: 'Value must be a number' }).min(0).optional(),
  textAlign: ZFieldTextAlignSchema.optional(),
  lineHeight: ZFieldMetaLineHeight.nullish(),
  letterSpacing: ZFieldMetaLetterSpacing.nullish(),
  verticalAlign: ZFieldMetaVerticalAlign.nullish(),
  ...ZConditionalMetaExtensions,
});
```

Do the same for `ZNumberFieldMeta`, `ZRadioFieldMeta`, `ZCheckboxFieldMeta`, `ZDropdownFieldMeta`. Leave `ZSignatureFieldMeta`, `ZInitialsFieldMeta`, `ZNameFieldMeta`, `ZEmailFieldMeta`, `ZDateFieldMeta`, and free-signature (no meta) UNMODIFIED so `.strict()`-ish behavior of the discriminated union excludes unknown keys. Note: discriminated-union parsing in zod is non-strict by default (unknown keys are stripped). Switch the dependent-ineligible schemas to `.strict()` so extra `visibility` or `stableId` is rejected:

```ts
export const ZSignatureFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('signature'),
}).strict();
// and same .strict() on Initials, Name, Email, Date
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/lib && npm run test -- field-meta.test
```

Expected: PASS — all 8 test cases.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/types/field-meta.ts packages/lib/types/field-meta.test.ts
git commit -m "feat(field-meta): add visibility + stableId to dependent-eligible meta"
```

---

### Task 2: Topological sort utility

**Spec:** §2.2 (DAG evaluation), §5.3 (cycle detection).

**Files:**
- Create: `packages/lib/universal/field-visibility/topological-sort.ts`
- Create: `packages/lib/universal/field-visibility/topological-sort.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/lib/universal/field-visibility/topological-sort.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { topologicalSort } from './topological-sort';

type N = { id: string; deps: string[] };

describe('topologicalSort', () => {
  const mk = (nodes: N[]) => ({
    ids: nodes.map((n) => n.id),
    dependenciesOf: (id: string) => nodes.find((n) => n.id === id)?.deps ?? [],
  });

  it('returns input unchanged when no edges exist', () => {
    const { ids, dependenciesOf } = mk([
      { id: 'a', deps: [] },
      { id: 'b', deps: [] },
    ]);
    const result = topologicalSort(ids, dependenciesOf);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(new Set(result.order)).toEqual(new Set(['a', 'b']));
  });

  it('sorts dependencies before dependents', () => {
    const { ids, dependenciesOf } = mk([
      { id: 'c', deps: ['b'] },
      { id: 'b', deps: ['a'] },
      { id: 'a', deps: [] },
    ]);
    const result = topologicalSort(ids, dependenciesOf);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.order.indexOf('a')).toBeLessThan(result.order.indexOf('b'));
    expect(result.order.indexOf('b')).toBeLessThan(result.order.indexOf('c'));
  });

  it('detects a direct 2-cycle and returns the path', () => {
    const { ids, dependenciesOf } = mk([
      { id: 'a', deps: ['b'] },
      { id: 'b', deps: ['a'] },
    ]);
    const result = topologicalSort(ids, dependenciesOf);
    expect(result.kind).toBe('cycle');
    if (result.kind !== 'cycle') return;
    expect(result.path).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('detects a 3-cycle', () => {
    const { ids, dependenciesOf } = mk([
      { id: 'a', deps: ['b'] },
      { id: 'b', deps: ['c'] },
      { id: 'c', deps: ['a'] },
    ]);
    const result = topologicalSort(ids, dependenciesOf);
    expect(result.kind).toBe('cycle');
  });

  it('ignores unknown dependency ids (fail-closed resolution happens elsewhere)', () => {
    const { ids, dependenciesOf } = mk([{ id: 'a', deps: ['missing'] }]);
    const result = topologicalSort(ids, dependenciesOf);
    expect(result.kind).toBe('ok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/lib && npm run test -- topological-sort.test
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `packages/lib/universal/field-visibility/topological-sort.ts`:

```ts
export type TopoResult =
  | { kind: 'ok'; order: string[] }
  | { kind: 'cycle'; path: string[] };

/**
 * Iterative DFS topological sort. Returns `kind: 'cycle'` with the path if the
 * graph is not a DAG. Unknown dependency ids (returned by dependenciesOf but
 * not in ids) are ignored — fail-closed handling happens in the evaluator.
 */
export const topologicalSort = (
  ids: string[],
  dependenciesOf: (id: string) => string[],
): TopoResult => {
  const known = new Set(ids);
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const order: string[] = [];

  const dfs = (start: string): string[] | null => {
    const stack: { id: string; parents: string[] }[] = [{ id: start, parents: [] }];
    const pending: string[] = [];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const { id, parents } = frame;

      if (visiting.has(id)) {
        const cycleStart = parents.indexOf(id);
        return cycleStart >= 0 ? parents.slice(cycleStart).concat(id) : [id];
      }

      if (visited.has(id)) {
        stack.pop();
        continue;
      }

      if (!pending.includes(id)) {
        visiting.add(id);
        pending.push(id);
      }

      const deps = dependenciesOf(id).filter((d) => known.has(d));
      const unvisitedDep = deps.find((d) => !visited.has(d));

      if (unvisitedDep) {
        if (visiting.has(unvisitedDep)) {
          return parents.concat(id, unvisitedDep);
        }
        stack.push({ id: unvisitedDep, parents: parents.concat(id) });
      } else {
        visiting.delete(id);
        visited.add(id);
        order.push(id);
        stack.pop();
      }
    }

    return null;
  };

  for (const id of ids) {
    if (visited.has(id)) continue;
    const cycle = dfs(id);
    if (cycle) return { kind: 'cycle', path: cycle };
  }

  return { kind: 'ok', order };
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/lib && npm run test -- topological-sort.test
```

Expected: PASS — all 5 test cases.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/universal/field-visibility/topological-sort.ts packages/lib/universal/field-visibility/topological-sort.test.ts
git commit -m "feat(field-visibility): add topological sort utility"
```

---

### Task 3: Core evaluator — operator semantics and per-field evaluation

**Spec:** §2.1–§2.3, §2.6 (fail-closed on missing trigger), §1.4 (trigger identification by stableId).

**Files:**
- Create: `packages/lib/universal/field-visibility/evaluate.ts`
- Create: `packages/lib/universal/field-visibility/evaluate.test.ts`
- Create: `packages/lib/universal/field-visibility/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/lib/universal/field-visibility/evaluate.test.ts`:

```ts
import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { TVisibilityBlock } from '../../types/field-meta';
import { evaluateAllVisibility } from './evaluate';

type MinField = {
  id: number;
  type: FieldType;
  recipientId: number;
  customText: string;
  inserted: boolean;
  fieldMeta: Record<string, unknown> | null;
};

const mkField = (overrides: Partial<MinField>): MinField => ({
  id: 1,
  type: FieldType.TEXT,
  recipientId: 1,
  customText: '',
  inserted: false,
  fieldMeta: null,
  ...overrides,
});

const vis = (block: TVisibilityBlock, stableId = 'dep'): Record<string, unknown> => ({
  type: 'text',
  stableId,
  visibility: block,
});

describe('evaluateAllVisibility — operator semantics', () => {
  it('radio equals: dependent visible when radio customText matches', () => {
    const trigger = mkField({
      id: 10,
      type: FieldType.RADIO,
      customText: 'Married',
      inserted: true,
      fieldMeta: { type: 'radio', stableId: 'mar' },
    });
    const dep = mkField({
      id: 11,
      type: FieldType.TEXT,
      fieldMeta: vis({
        match: 'all',
        rules: [{ operator: 'equals', triggerFieldStableId: 'mar', value: 'Married' }],
      }),
    });
    const map = evaluateAllVisibility([trigger, dep]);
    expect(map.get(11)).toBe(true);
  });

  it('radio equals: case-insensitive and trimmed', () => {
    const trigger = mkField({
      id: 10, type: FieldType.RADIO, customText: '  married ', inserted: true,
      fieldMeta: { type: 'radio', stableId: 'mar' },
    });
    const dep = mkField({
      id: 11, fieldMeta: vis({
        match: 'all',
        rules: [{ operator: 'equals', triggerFieldStableId: 'mar', value: 'Married' }],
      }),
    });
    expect(evaluateAllVisibility([trigger, dep]).get(11)).toBe(true);
  });

  it('text contains substring match', () => {
    const trigger = mkField({
      id: 10, type: FieldType.TEXT, customText: 'John Smith', inserted: true,
      fieldMeta: { type: 'text', stableId: 'name' },
    });
    const dep = mkField({
      id: 11, fieldMeta: vis({
        match: 'all',
        rules: [{ operator: 'contains', triggerFieldStableId: 'name', value: 'smith' }],
      }),
    });
    expect(evaluateAllVisibility([trigger, dep]).get(11)).toBe(true);
  });

  it('checkbox contains: customText is JSON array; match by value', () => {
    const trigger = mkField({
      id: 10, type: FieldType.CHECKBOX,
      customText: '["1"]',
      inserted: true,
      fieldMeta: {
        type: 'checkbox', stableId: 'cbx',
        values: [{ id: 1, checked: false, value: 'Yes' }, { id: 2, checked: false, value: 'No' }],
      },
    });
    const dep = mkField({
      id: 11, fieldMeta: vis({
        match: 'all',
        rules: [{ operator: 'contains', triggerFieldStableId: 'cbx', value: 'Yes' }],
      }),
    });
    expect(evaluateAllVisibility([trigger, dep]).get(11)).toBe(true);
  });

  it('isEmpty when trigger not inserted', () => {
    const trigger = mkField({
      id: 10, type: FieldType.TEXT, customText: '', inserted: false,
      fieldMeta: { type: 'text', stableId: 't' },
    });
    const dep = mkField({
      id: 11, fieldMeta: vis({
        match: 'all',
        rules: [{ operator: 'isEmpty', triggerFieldStableId: 't' }],
      }),
    });
    expect(evaluateAllVisibility([trigger, dep]).get(11)).toBe(true);
  });

  it('isNotEmpty when trigger inserted with value', () => {
    const trigger = mkField({
      id: 10, type: FieldType.TEXT, customText: 'hello', inserted: true,
      fieldMeta: { type: 'text', stableId: 't' },
    });
    const dep = mkField({
      id: 11, fieldMeta: vis({
        match: 'all',
        rules: [{ operator: 'isNotEmpty', triggerFieldStableId: 't' }],
      }),
    });
    expect(evaluateAllVisibility([trigger, dep]).get(11)).toBe(true);
  });

  it('match=all requires every rule to pass', () => {
    const t1 = mkField({ id: 1, type: FieldType.RADIO, customText: 'Yes', inserted: true, fieldMeta: { type: 'radio', stableId: 'a' } });
    const t2 = mkField({ id: 2, type: FieldType.RADIO, customText: 'No', inserted: true, fieldMeta: { type: 'radio', stableId: 'b' } });
    const dep = mkField({
      id: 3, fieldMeta: vis({
        match: 'all',
        rules: [
          { operator: 'equals', triggerFieldStableId: 'a', value: 'Yes' },
          { operator: 'equals', triggerFieldStableId: 'b', value: 'Yes' },
        ],
      }),
    });
    expect(evaluateAllVisibility([t1, t2, dep]).get(3)).toBe(false);
  });

  it('match=any requires at least one rule to pass', () => {
    const t1 = mkField({ id: 1, type: FieldType.RADIO, customText: 'Yes', inserted: true, fieldMeta: { type: 'radio', stableId: 'a' } });
    const t2 = mkField({ id: 2, type: FieldType.RADIO, customText: 'No', inserted: true, fieldMeta: { type: 'radio', stableId: 'b' } });
    const dep = mkField({
      id: 3, fieldMeta: vis({
        match: 'any',
        rules: [
          { operator: 'equals', triggerFieldStableId: 'a', value: 'Yes' },
          { operator: 'equals', triggerFieldStableId: 'b', value: 'Yes' },
        ],
      }),
    });
    expect(evaluateAllVisibility([t1, t2, dep]).get(3)).toBe(true);
  });

  it('missing trigger → dependent hidden (fail-closed)', () => {
    const dep = mkField({
      id: 3, fieldMeta: vis({
        match: 'all',
        rules: [{ operator: 'equals', triggerFieldStableId: 'gone', value: 'x' }],
      }),
    });
    expect(evaluateAllVisibility([dep]).get(3)).toBe(false);
  });

  it('fields with no visibility block are always visible', () => {
    const f = mkField({ id: 5, fieldMeta: { type: 'text' } });
    expect(evaluateAllVisibility([f]).get(5)).toBe(true);
  });

  it('chained: A triggers B, B triggers C — all visible when met', () => {
    const a = mkField({
      id: 1, type: FieldType.RADIO, customText: 'Yes', inserted: true,
      fieldMeta: { type: 'radio', stableId: 'A' },
    });
    const b = mkField({
      id: 2, type: FieldType.TEXT, customText: 'Jane', inserted: true,
      fieldMeta: {
        ...vis({ match: 'all', rules: [{ operator: 'equals', triggerFieldStableId: 'A', value: 'Yes' }] }, 'B'),
      },
    });
    const c = mkField({
      id: 3, type: FieldType.TEXT,
      fieldMeta: vis({ match: 'all', rules: [{ operator: 'isNotEmpty', triggerFieldStableId: 'B' }] }, 'C'),
    });
    const m = evaluateAllVisibility([a, b, c]);
    expect(m.get(2)).toBe(true);
    expect(m.get(3)).toBe(true);
  });

  it('chained: when A fails, B hides, and C evaluates against hidden B (still sees its committed value)', () => {
    const a = mkField({
      id: 1, type: FieldType.RADIO, customText: 'No', inserted: true,
      fieldMeta: { type: 'radio', stableId: 'A' },
    });
    const b = mkField({
      id: 2, type: FieldType.TEXT, customText: 'Jane', inserted: true,
      fieldMeta: vis({ match: 'all', rules: [{ operator: 'equals', triggerFieldStableId: 'A', value: 'Yes' }] }, 'B'),
    });
    const m = evaluateAllVisibility([a, b]);
    expect(m.get(2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/lib && npm run test -- evaluate.test
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the evaluator**

Create `packages/lib/universal/field-visibility/evaluate.ts`:

```ts
import { FieldType } from '@prisma/client';

import type { TVisibilityBlock, TVisibilityRule } from '../../types/field-meta';
import { topologicalSort } from './topological-sort';

type EvaluatableField = {
  id: number;
  type: FieldType;
  customText: string;
  inserted: boolean;
  fieldMeta: unknown;
};

const getStableId = (field: EvaluatableField): string | null => {
  const meta = field.fieldMeta as { stableId?: unknown } | null;
  return meta && typeof meta.stableId === 'string' ? meta.stableId : null;
};

const getVisibility = (field: EvaluatableField): TVisibilityBlock | null => {
  const meta = field.fieldMeta as { visibility?: TVisibilityBlock } | null;
  return meta?.visibility ?? null;
};

const normalize = (s: string): string => s.trim().toLowerCase();

const parseCheckboxCustomText = (customText: string): string[] => {
  if (!customText) return [];
  try {
    const parsed = JSON.parse(customText);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

/**
 * Resolve the current "value" the rule sees for a trigger field.
 * - For checkbox: list of checked option VALUES (not ids).
 * - For everything else: trigger.customText (empty string if not inserted).
 */
const triggerValueFor = (trigger: EvaluatableField): { isEmpty: boolean; scalar: string; list: string[] } => {
  if (!trigger.inserted) return { isEmpty: true, scalar: '', list: [] };

  if (trigger.type === FieldType.CHECKBOX) {
    const selectedIds = parseCheckboxCustomText(trigger.customText);
    const meta = trigger.fieldMeta as { values?: Array<{ id: number; value: string }> } | null;
    const byId = new Map((meta?.values ?? []).map((v) => [String(v.id), v.value]));
    const list = selectedIds.map((id) => byId.get(id) ?? id);
    return { isEmpty: list.length === 0, scalar: '', list };
  }

  const scalar = (trigger.customText ?? '').toString();
  return { isEmpty: scalar.trim() === '', scalar, list: [] };
};

const evaluateRule = (
  rule: TVisibilityRule,
  trigger: EvaluatableField | null,
): boolean => {
  if (!trigger) return false; // fail-closed
  const v = triggerValueFor(trigger);

  switch (rule.operator) {
    case 'isEmpty':
      return v.isEmpty;
    case 'isNotEmpty':
      return !v.isEmpty;
    case 'equals':
      return normalize(v.scalar) === normalize(rule.value);
    case 'notEquals':
      return normalize(v.scalar) !== normalize(rule.value);
    case 'contains':
      if (trigger.type === FieldType.CHECKBOX) {
        return v.list.map(normalize).includes(normalize(rule.value));
      }
      return normalize(v.scalar).includes(normalize(rule.value));
    case 'notContains':
      if (trigger.type === FieldType.CHECKBOX) {
        return !v.list.map(normalize).includes(normalize(rule.value));
      }
      return !normalize(v.scalar).includes(normalize(rule.value));
    default:
      return false;
  }
};

export const evaluateVisibility = (
  field: EvaluatableField,
  siblings: EvaluatableField[],
): { visible: boolean } => {
  const block = getVisibility(field);
  if (!block) return { visible: true };

  const siblingsByStableId = new Map<string, EvaluatableField>();
  for (const s of siblings) {
    const sid = getStableId(s);
    if (sid) siblingsByStableId.set(sid, s);
  }

  const checks = block.rules.map((rule) =>
    evaluateRule(rule, siblingsByStableId.get(rule.triggerFieldStableId) ?? null),
  );

  return {
    visible: block.match === 'all' ? checks.every(Boolean) : checks.some(Boolean),
  };
};

/**
 * Evaluates all fields for a single recipient. Topologically orders by
 * dependency so a chained dependent's visibility considers its trigger's state
 * (the trigger's VALUE always counts, even if the trigger is itself hidden —
 * hidden triggers with a pre-commit value will be cleared at completion; for
 * the moment, their customText is the source of truth).
 */
export const evaluateAllVisibility = (
  fields: EvaluatableField[],
): Map<number, boolean> => {
  const result = new Map<number, boolean>();

  const byStableId = new Map<string, EvaluatableField>();
  for (const f of fields) {
    const sid = getStableId(f);
    if (sid) byStableId.set(sid, f);
  }

  const ids = fields.map((f) => String(f.id));
  const byId = new Map(fields.map((f) => [String(f.id), f] as const));

  const dependenciesOf = (idStr: string) => {
    const field = byId.get(idStr);
    if (!field) return [];
    const block = getVisibility(field);
    if (!block) return [];
    return block.rules
      .map((r) => byStableId.get(r.triggerFieldStableId))
      .filter((f): f is EvaluatableField => !!f)
      .map((f) => String(f.id));
  };

  const sorted = topologicalSort(ids, dependenciesOf);
  const order =
    sorted.kind === 'ok'
      ? sorted.order.map((s) => byId.get(s)!).filter(Boolean)
      : fields;

  for (const field of order) {
    if (sorted.kind === 'cycle') {
      result.set(field.id, false); // fail-closed on corrupt data
      continue;
    }
    const { visible } = evaluateVisibility(field, fields);
    result.set(field.id, visible);
  }

  return result;
};
```

Create `packages/lib/universal/field-visibility/index.ts`:

```ts
export * from './evaluate';
export * from './topological-sort';
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/lib && npm run test -- evaluate.test
```

Expected: PASS — all test cases.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/universal/field-visibility/evaluate.ts packages/lib/universal/field-visibility/evaluate.test.ts packages/lib/universal/field-visibility/index.ts
git commit -m "feat(field-visibility): core evaluator with operator semantics"
```

---

### Task 4: Cross-field validator (server-only)

**Spec:** §5.2 (rules), §5.3 (cycle detection), §5.4 (stableId lifecycle), §5.5 (bulk semantics).

**Files:**
- Create: `packages/lib/server-only/envelope/validate-field-visibility.ts`
- Create: `packages/lib/server-only/envelope/validate-field-visibility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/lib/server-only/envelope/validate-field-visibility.test.ts`:

```ts
import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { validateFieldVisibility } from './validate-field-visibility';

const field = (overrides: Partial<Parameters<typeof validateFieldVisibility>[0]['fields'][number]>) => ({
  id: 1,
  type: FieldType.TEXT,
  recipientId: 1,
  fieldMeta: null as unknown,
  ...overrides,
});

describe('validateFieldVisibility', () => {
  it('passes when no fields have visibility rules', () => {
    expect(
      validateFieldVisibility({ fields: [field({ id: 1 }), field({ id: 2 })] }).ok,
    ).toBe(true);
  });

  it('rejects if trigger stableId does not exist', () => {
    const result = validateFieldVisibility({
      fields: [
        field({
          id: 1,
          fieldMeta: {
            type: 'text', stableId: 'dep',
            visibility: { match: 'all', rules: [{ operator: 'equals', triggerFieldStableId: 'nope', value: 'x' }] },
          },
        }),
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('FIELD_VISIBILITY_TRIGGER_NOT_FOUND');
  });

  it('rejects cross-recipient references', () => {
    const result = validateFieldVisibility({
      fields: [
        field({
          id: 1, recipientId: 1, type: FieldType.RADIO,
          fieldMeta: { type: 'radio', stableId: 'trig' },
        }),
        field({
          id: 2, recipientId: 2,
          fieldMeta: {
            type: 'text', stableId: 'dep',
            visibility: { match: 'all', rules: [{ operator: 'equals', triggerFieldStableId: 'trig', value: 'x' }] },
          },
        }),
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('FIELD_VISIBILITY_CROSS_RECIPIENT');
  });

  it('rejects ineligible trigger type (signature)', () => {
    const result = validateFieldVisibility({
      fields: [
        field({ id: 1, type: FieldType.SIGNATURE, fieldMeta: { type: 'signature', stableId: 'sig' } }),
        field({
          id: 2, fieldMeta: {
            type: 'text', stableId: 'dep',
            visibility: { match: 'all', rules: [{ operator: 'equals', triggerFieldStableId: 'sig', value: 'x' }] },
          },
        }),
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('FIELD_VISIBILITY_TRIGGER_INELIGIBLE');
  });

  it('rejects radio value not in trigger options', () => {
    const result = validateFieldVisibility({
      fields: [
        field({
          id: 1, type: FieldType.RADIO,
          fieldMeta: {
            type: 'radio', stableId: 'trig',
            values: [{ id: 1, checked: false, value: 'Yes' }, { id: 2, checked: false, value: 'No' }],
          },
        }),
        field({
          id: 2, fieldMeta: {
            type: 'text', stableId: 'dep',
            visibility: { match: 'all', rules: [{ operator: 'equals', triggerFieldStableId: 'trig', value: 'Maybe' }] },
          },
        }),
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('FIELD_VISIBILITY_VALUE_INVALID');
  });

  it('allows free-form text value for text triggers', () => {
    const result = validateFieldVisibility({
      fields: [
        field({ id: 1, type: FieldType.TEXT, fieldMeta: { type: 'text', stableId: 'trig' } }),
        field({
          id: 2, fieldMeta: {
            type: 'text', stableId: 'dep',
            visibility: { match: 'all', rules: [{ operator: 'contains', triggerFieldStableId: 'trig', value: 'anything' }] },
          },
        }),
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('detects self-reference', () => {
    const result = validateFieldVisibility({
      fields: [
        field({
          id: 1, type: FieldType.TEXT,
          fieldMeta: {
            type: 'text', stableId: 'loop',
            visibility: { match: 'all', rules: [{ operator: 'equals', triggerFieldStableId: 'loop', value: 'x' }] },
          },
        }),
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('FIELD_VISIBILITY_SELF_REFERENCE');
  });

  it('detects 2-cycle', () => {
    const result = validateFieldVisibility({
      fields: [
        field({
          id: 1, type: FieldType.TEXT,
          fieldMeta: {
            type: 'text', stableId: 'A',
            visibility: { match: 'all', rules: [{ operator: 'isNotEmpty', triggerFieldStableId: 'B' }] },
          },
        }),
        field({
          id: 2, type: FieldType.TEXT,
          fieldMeta: {
            type: 'text', stableId: 'B',
            visibility: { match: 'all', rules: [{ operator: 'isNotEmpty', triggerFieldStableId: 'A' }] },
          },
        }),
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'FIELD_VISIBILITY_CYCLE')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/lib && npm run test -- validate-field-visibility.test
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the validator**

Create `packages/lib/server-only/envelope/validate-field-visibility.ts`:

```ts
import { FieldType } from '@prisma/client';

import { topologicalSort } from '../../universal/field-visibility/topological-sort';

export type FieldVisibilityErrorCode =
  | 'FIELD_VISIBILITY_TRIGGER_NOT_FOUND'
  | 'FIELD_VISIBILITY_TRIGGER_INELIGIBLE'
  | 'FIELD_VISIBILITY_CROSS_RECIPIENT'
  | 'FIELD_VISIBILITY_VALUE_INVALID'
  | 'FIELD_VISIBILITY_SELF_REFERENCE'
  | 'FIELD_VISIBILITY_CYCLE';

export type FieldVisibilityError = {
  fieldId: number;
  ruleIndex: number | null;
  code: FieldVisibilityErrorCode;
  message: string;
  cyclePath?: string[];
};

type ValidatableField = {
  id: number;
  type: FieldType;
  recipientId: number;
  fieldMeta: unknown;
};

const ELIGIBLE_TRIGGER_TYPES = new Set<FieldType>([
  FieldType.RADIO,
  FieldType.CHECKBOX,
  FieldType.DROPDOWN,
  FieldType.TEXT,
]);

const extractVisibility = (field: ValidatableField) => {
  const meta = field.fieldMeta as { stableId?: string; visibility?: { match: 'all' | 'any'; rules: Array<{ operator: string; triggerFieldStableId: string; value?: string }> } } | null;
  return meta?.visibility ?? null;
};

const extractStableId = (field: ValidatableField): string | null => {
  const meta = field.fieldMeta as { stableId?: string } | null;
  return meta?.stableId ?? null;
};

const triggerOptionValues = (field: ValidatableField): string[] | null => {
  const meta = field.fieldMeta as
    | { values?: Array<{ value: string } | { value: string; id: number; checked: boolean }> }
    | null;
  if (!meta?.values) return null;
  return meta.values.map((v) => v.value);
};

export const validateFieldVisibility = (input: {
  fields: ValidatableField[];
}): { ok: true } | { ok: false; errors: FieldVisibilityError[] } => {
  const errors: FieldVisibilityError[] = [];
  const byStableId = new Map<string, ValidatableField>();
  for (const f of input.fields) {
    const sid = extractStableId(f);
    if (sid) byStableId.set(sid, f);
  }

  for (const dep of input.fields) {
    const block = extractVisibility(dep);
    if (!block) continue;

    const depStableId = extractStableId(dep);

    block.rules.forEach((rule, ruleIndex) => {
      const trigger = byStableId.get(rule.triggerFieldStableId);

      if (rule.triggerFieldStableId === depStableId) {
        errors.push({
          fieldId: dep.id, ruleIndex, code: 'FIELD_VISIBILITY_SELF_REFERENCE',
          message: 'A field cannot reference itself as a visibility trigger.',
        });
        return;
      }

      if (!trigger) {
        errors.push({
          fieldId: dep.id, ruleIndex, code: 'FIELD_VISIBILITY_TRIGGER_NOT_FOUND',
          message: `Trigger field with stableId "${rule.triggerFieldStableId}" not found.`,
        });
        return;
      }

      if (trigger.recipientId !== dep.recipientId) {
        errors.push({
          fieldId: dep.id, ruleIndex, code: 'FIELD_VISIBILITY_CROSS_RECIPIENT',
          message: 'Visibility trigger must be on the same recipient as the dependent field.',
        });
        return;
      }

      if (!ELIGIBLE_TRIGGER_TYPES.has(trigger.type)) {
        errors.push({
          fieldId: dep.id, ruleIndex, code: 'FIELD_VISIBILITY_TRIGGER_INELIGIBLE',
          message: `Trigger field type ${trigger.type} cannot be used. Eligible types: RADIO, CHECKBOX, DROPDOWN, TEXT.`,
        });
        return;
      }

      if (
        (trigger.type === FieldType.RADIO ||
         trigger.type === FieldType.CHECKBOX ||
         trigger.type === FieldType.DROPDOWN) &&
        (rule.operator === 'equals' || rule.operator === 'notEquals' ||
         rule.operator === 'contains' || rule.operator === 'notContains')
      ) {
        const allowed = triggerOptionValues(trigger);
        if (allowed && rule.value !== undefined && !allowed.includes(rule.value)) {
          errors.push({
            fieldId: dep.id, ruleIndex, code: 'FIELD_VISIBILITY_VALUE_INVALID',
            message: `Value "${rule.value}" is not among the trigger's defined options.`,
          });
        }
      }
    });
  }

  // Cycle detection across all fields that have a visibility block.
  const relevantIds = input.fields
    .filter((f) => extractVisibility(f) !== null)
    .map((f) => String(f.id));
  const byId = new Map(input.fields.map((f) => [String(f.id), f] as const));

  const dependenciesOf = (idStr: string) => {
    const f = byId.get(idStr);
    if (!f) return [];
    const v = extractVisibility(f);
    if (!v) return [];
    return v.rules
      .map((r) => byStableId.get(r.triggerFieldStableId))
      .filter((t): t is ValidatableField => !!t)
      .map((t) => String(t.id));
  };

  const sorted = topologicalSort(relevantIds, dependenciesOf);
  if (sorted.kind === 'cycle') {
    const pathFields = sorted.path.map((idStr) => byId.get(idStr)).filter(Boolean) as ValidatableField[];
    for (const f of pathFields) {
      errors.push({
        fieldId: f.id, ruleIndex: null, code: 'FIELD_VISIBILITY_CYCLE',
        message: `Visibility rule would create a circular dependency: ${sorted.path.join(' → ')}.`,
        cyclePath: sorted.path,
      });
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/lib && npm run test -- validate-field-visibility.test
```

Expected: PASS — all test cases.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/server-only/envelope/validate-field-visibility.ts packages/lib/server-only/envelope/validate-field-visibility.test.ts
git commit -m "feat(field-visibility): cross-field validator with cycle detection"
```

---

### Task 5: Register new `AppErrorCode` values

**Spec:** §6.7 (error codes).

**Files:**
- Modify: the file defining `AppErrorCode` enum. Locate first: `grep -rn "export enum AppErrorCode\\|AppErrorCode =" packages/lib/errors/`.

- [ ] **Step 1: Locate the enum**

```bash
grep -rn "AppErrorCode" packages/lib/errors/ | head -5
```

Expected path: `packages/lib/errors/app-error.ts`. Use whatever file holds the enum.

- [ ] **Step 2: Add new codes**

Add to the enum (keep alphabetical or grouped with the existing pattern):

```ts
FIELD_VISIBILITY_TRIGGER_NOT_FOUND = 'FIELD_VISIBILITY_TRIGGER_NOT_FOUND',
FIELD_VISIBILITY_TRIGGER_INELIGIBLE = 'FIELD_VISIBILITY_TRIGGER_INELIGIBLE',
FIELD_VISIBILITY_CROSS_RECIPIENT = 'FIELD_VISIBILITY_CROSS_RECIPIENT',
FIELD_VISIBILITY_VALUE_INVALID = 'FIELD_VISIBILITY_VALUE_INVALID',
FIELD_VISIBILITY_SELF_REFERENCE = 'FIELD_VISIBILITY_SELF_REFERENCE',
FIELD_VISIBILITY_CYCLE = 'FIELD_VISIBILITY_CYCLE',
FIELD_NOT_VISIBLE = 'FIELD_NOT_VISIBLE',
```

- [ ] **Step 3: TypeScript compilation check**

```bash
cd packages/lib && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/lib/errors/app-error.ts
git commit -m "feat(errors): add field-visibility error codes"
```

---

### Task 6: stableId assignment helper + integration point

**Spec:** §1.4, §5.4 (stableId lifecycle), §5.5 (bulk semantics).

**Files:**
- Create: `packages/lib/server-only/envelope/assign-field-stable-ids.ts`
- Create: `packages/lib/server-only/envelope/assign-field-stable-ids.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/lib/server-only/envelope/assign-field-stable-ids.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { assignFieldStableIds } from './assign-field-stable-ids';

describe('assignFieldStableIds', () => {
  it('assigns stableId to dependents and referenced triggers; leaves others untouched', () => {
    const input = [
      { id: 1, fieldMeta: { type: 'radio', stableId: 'trig' } },
      { id: 2, fieldMeta: {
        type: 'text',
        visibility: { match: 'all', rules: [{ operator: 'equals', triggerFieldStableId: 'trig', value: 'x' }] },
      } },
      { id: 3, fieldMeta: { type: 'text' } },
    ];
    const result = assignFieldStableIds(input);
    expect(result[0].fieldMeta.stableId).toBe('trig');
    expect(typeof result[1].fieldMeta.stableId).toBe('string');
    expect(result[1].fieldMeta.stableId!.length).toBeGreaterThan(0);
    expect(result[2].fieldMeta.stableId).toBeUndefined();
  });

  it('assigns stableId to a referenced trigger that has none yet', () => {
    const input = [
      { id: 1, fieldMeta: { type: 'radio' } }, // no stableId yet
      { id: 2, fieldMeta: {
        type: 'text', stableId: 'dep',
        visibility: { match: 'all', rules: [{ operator: 'isEmpty', triggerFieldStableId: 'NEW_TRIG' }] },
      } },
    ];
    // The referenced trigger is identified by a stableId that does not exist.
    // We cannot auto-match by id here; this test asserts behavior on RE-SAVES of
    // the dependent alone: we leave the rule intact; the validator will reject.
    const result = assignFieldStableIds(input);
    expect(result[0].fieldMeta.stableId).toBeUndefined();
    expect(result[1].fieldMeta.stableId).toBe('dep');
  });

  it('does NOT change an existing stableId', () => {
    const input = [{ id: 1, fieldMeta: { type: 'text', stableId: 'preserved' } }];
    const result = assignFieldStableIds(input);
    expect(result[0].fieldMeta.stableId).toBe('preserved');
  });

  it('assigns a stableId when a field needs one because it is itself a dependent', () => {
    const input = [
      { id: 1, fieldMeta: { type: 'radio', stableId: 'trig' } },
      { id: 2, fieldMeta: {
        type: 'text',
        visibility: { match: 'all', rules: [{ operator: 'equals', triggerFieldStableId: 'trig', value: 'x' }] },
      } },
    ];
    const result = assignFieldStableIds(input);
    expect(typeof result[1].fieldMeta.stableId).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/lib && npm run test -- assign-field-stable-ids.test
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `packages/lib/server-only/envelope/assign-field-stable-ids.ts`:

```ts
import { createId } from '@paralleldrive/cuid2';

type FieldLike = {
  id: number | string;
  fieldMeta: Record<string, unknown> | null | undefined;
};

/**
 * Immutably assigns a stableId to:
 *   - any field that owns a visibility block (dependent), and
 *   - any field whose stableId is referenced by another field's rule AND that
 *     field already has an existing stableId (we do not infer or create
 *     references; we only ensure dependents have one).
 *
 * Preserves existing stableIds.
 */
export const assignFieldStableIds = <T extends FieldLike>(fields: T[]): T[] => {
  return fields.map((f) => {
    const meta = (f.fieldMeta ?? {}) as Record<string, unknown>;
    const hasVisibility = Boolean((meta as { visibility?: unknown }).visibility);

    if (!hasVisibility) return f;
    if (typeof meta.stableId === 'string' && meta.stableId.length > 0) return f;

    return {
      ...f,
      fieldMeta: { ...meta, stableId: createId() },
    };
  });
};
```

Verify cuid2 is available:

```bash
cd packages/lib && node -e "require('@paralleldrive/cuid2')" 2>&1 || echo "MISSING"
```

If missing:

```bash
cd packages/lib && npm install @paralleldrive/cuid2
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/lib && npm run test -- assign-field-stable-ids.test
```

Expected: PASS — all cases.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/server-only/envelope/assign-field-stable-ids.ts packages/lib/server-only/envelope/assign-field-stable-ids.test.ts packages/lib/package.json packages/lib/package-lock.json
git commit -m "feat(field-visibility): stableId assignment helper"
```

---

### Task 7: Wire validator + stableId into `create-envelope-fields`

**Spec:** §5.2, §5.4, §5.5, §6.2 (createMany).

**Files:**
- Modify: `packages/lib/server-only/field/create-envelope-fields.ts`

- [ ] **Step 1: Read the existing handler (lines 246–288)**

Confirm structure:

```bash
sed -n '240,295p' packages/lib/server-only/field/create-envelope-fields.ts
```

- [ ] **Step 2: Wire in validator and stableId assignment**

Add imports at the top:

```ts
import { AppError, AppErrorCode } from '../../errors/app-error';
import { assignFieldStableIds } from '../envelope/assign-field-stable-ids';
import { validateFieldVisibility } from '../envelope/validate-field-visibility';
```

Before the `prisma.$transaction(...)` call (around line 246), add:

```ts
// Merge new fields with existing envelope fields for cross-field validation.
const mergedForValidation = [
  ...envelope.fields.map((f) => ({
    id: f.id,
    type: f.type,
    recipientId: f.recipientId,
    fieldMeta: f.fieldMeta as Record<string, unknown> | null,
  })),
  // Incoming fields don't have a real id yet — use negative sentinels so they
  // participate in cycle detection without colliding.
  ...validatedFields.map((vf, idx) => ({
    id: -(idx + 1),
    type: vf.type,
    recipientId: vf.recipientId,
    fieldMeta: vf.fieldMeta as Record<string, unknown> | null,
  })),
];

// Auto-assign stableIds on incoming fields that need one.
const assignedIncoming = assignFieldStableIds(
  validatedFields.map((vf) => ({ id: vf.recipientId, fieldMeta: vf.fieldMeta as Record<string, unknown> | null })),
);
validatedFields.forEach((vf, idx) => {
  vf.fieldMeta = assignedIncoming[idx].fieldMeta as typeof vf.fieldMeta;
});

// Re-build merged with assigned stableIds in place, then validate.
const mergedForValidation2 = [
  ...envelope.fields.map((f) => ({
    id: f.id,
    type: f.type,
    recipientId: f.recipientId,
    fieldMeta: f.fieldMeta as Record<string, unknown> | null,
  })),
  ...validatedFields.map((vf, idx) => ({
    id: -(idx + 1),
    type: vf.type,
    recipientId: vf.recipientId,
    fieldMeta: vf.fieldMeta as Record<string, unknown> | null,
  })),
];

const validation = validateFieldVisibility({ fields: mergedForValidation2 });
if (!validation.ok) {
  throw new AppError(AppErrorCode.INVALID_REQUEST, {
    message: validation.errors[0].message,
    userMessage: validation.errors[0].message,
  });
}
```

(If the local `AppError` already imports somewhere else in the file, deduplicate.)

- [ ] **Step 3: Run type check**

```bash
cd packages/lib && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke the existing tests for this module**

```bash
cd packages/lib && npm run test -- field
```

Expected: PASS for existing tests (no behavior change when no visibility rules are in play).

- [ ] **Step 5: Commit**

```bash
git add packages/lib/server-only/field/create-envelope-fields.ts
git commit -m "feat(create-envelope-fields): validate visibility + assign stableIds"
```

---

### Task 8: Wire validator + stableId into `update-envelope-fields`, `set-fields-for-document`, `set-fields-for-template`

**Spec:** §5.2, §5.4, §5.5, §6.2.

**Files:**
- Modify: `packages/lib/server-only/field/update-envelope-fields.ts`
- Modify: `packages/lib/server-only/field/set-fields-for-document.ts`
- Modify: `packages/lib/server-only/field/set-fields-for-template.ts`

- [ ] **Step 1: Read each handler to find the persistence step**

```bash
grep -n "prisma.field.update\\|prisma.field.create\\|prisma.$transaction" packages/lib/server-only/field/update-envelope-fields.ts packages/lib/server-only/field/set-fields-for-document.ts packages/lib/server-only/field/set-fields-for-template.ts
```

- [ ] **Step 2: For each file, insert the same validation block**

Pattern (adapt to the file's local variable names):

```ts
import { AppError, AppErrorCode } from '../../errors/app-error';
import { assignFieldStableIds } from '../envelope/assign-field-stable-ids';
import { validateFieldVisibility } from '../envelope/validate-field-visibility';

// ... inside the handler, after the input is shaped and the envelope is loaded:

const incomingAssigned = assignFieldStableIds(
  incomingFields.map((f) => ({ id: f.id ?? 0, fieldMeta: f.fieldMeta })),
);

// Build merged view: existing envelope fields, overlaid with incoming updates
// (matched by id), plus any new fields as sentinels.
const merged = mergeForValidation(envelope.fields, incomingAssigned);

const validation = validateFieldVisibility({ fields: merged });
if (!validation.ok) {
  throw new AppError(AppErrorCode.INVALID_REQUEST, {
    message: validation.errors[0].message,
    userMessage: validation.errors[0].message,
  });
}
```

Extract `mergeForValidation` into a shared helper to avoid duplication. Put it in `packages/lib/server-only/envelope/merge-fields-for-validation.ts`:

```ts
type ExistingField = { id: number; type: string; recipientId: number; fieldMeta: unknown };
type IncomingField = { id?: number | null; type: string; recipientId: number; fieldMeta: unknown };

export const mergeFieldsForValidation = (
  existing: ExistingField[],
  incoming: IncomingField[],
): Array<{ id: number; type: any; recipientId: number; fieldMeta: any }> => {
  const byId = new Map(existing.map((f) => [f.id, f] as const));
  const merged: Array<{ id: number; type: any; recipientId: number; fieldMeta: any }> = [];
  const usedIds = new Set<number>();

  for (const inc of incoming) {
    if (inc.id && byId.has(inc.id)) {
      usedIds.add(inc.id);
      merged.push({
        id: inc.id,
        type: inc.type as any,
        recipientId: inc.recipientId,
        fieldMeta: inc.fieldMeta,
      });
    } else {
      merged.push({
        id: -(merged.length + 1),
        type: inc.type as any,
        recipientId: inc.recipientId,
        fieldMeta: inc.fieldMeta,
      });
    }
  }

  for (const f of existing) {
    if (!usedIds.has(f.id)) merged.push(f as any);
  }
  return merged;
};
```

Replace the inline merge in Task 7's `create-envelope-fields` changes with a call to this helper too.

- [ ] **Step 3: Type check**

```bash
cd packages/lib && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Existing tests still pass**

```bash
cd packages/lib && npm run test -- field envelope
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/server-only/envelope/merge-fields-for-validation.ts packages/lib/server-only/field/update-envelope-fields.ts packages/lib/server-only/field/set-fields-for-document.ts packages/lib/server-only/field/set-fields-for-template.ts packages/lib/server-only/field/create-envelope-fields.ts
git commit -m "feat(field): validate visibility on update/set endpoints"
```

---

### Task 9: Runtime `FIELD_NOT_VISIBLE` check in `sign-field-with-token`

**Spec:** §2.5.

**Files:**
- Modify: `packages/lib/server-only/field/sign-field-with-token.ts`

- [ ] **Step 1: Locate the point after field load, before validation/insert**

```bash
grep -n "prisma.field.findFirstOrThrow\\|prisma.field.update" packages/lib/server-only/field/sign-field-with-token.ts | head -5
```

- [ ] **Step 2: Add the visibility guard**

Add import:

```ts
import { evaluateAllVisibility } from '../../universal/field-visibility';
```

After the `field` is loaded (around line 66 in the snippet; place after all auth/validation checks are loaded and the recipient's full field set is available), add:

```ts
const recipientFields = await prisma.field.findMany({
  where: {
    envelopeId: field.envelopeId,
    recipientId: field.recipientId,
  },
});

const visibilityMap = evaluateAllVisibility(
  recipientFields.map((f) => ({
    id: f.id,
    type: f.type,
    customText: f.customText,
    inserted: f.inserted,
    fieldMeta: f.fieldMeta,
  })),
);

if (visibilityMap.get(field.id) === false) {
  throw new AppError(AppErrorCode.FIELD_NOT_VISIBLE, {
    message: 'This field is not currently active and cannot be signed.',
    userMessage: 'This field is not currently active.',
  });
}
```

(If `AppError`/`AppErrorCode` is not yet imported in this file, add the import.)

- [ ] **Step 3: Type check**

```bash
cd packages/lib && npx tsc --noEmit
```

- [ ] **Step 4: Existing sign-field tests still pass**

```bash
cd packages/lib && npm run test -- sign-field
```

Expected: PASS (this test file may or may not exist; if it does, tests must pass).

- [ ] **Step 5: Commit**

```bash
git add packages/lib/server-only/field/sign-field-with-token.ts
git commit -m "feat(sign-field): reject signing of hidden fields at runtime"
```

---

### Task 10: Visibility-aware required helper + completion sweep

**Spec:** §2.5, §7.1 (FIELD_SKIPPED_CONDITIONAL).

**Files:**
- Modify: `packages/lib/utils/advanced-fields-helpers.ts`
- Modify: `packages/lib/server-only/document/complete-document-with-token.ts`
- Modify: `packages/lib/types/document-audit-logs.ts`

- [ ] **Step 1: Add new audit log event types**

In `packages/lib/types/document-audit-logs.ts`, add to the `ZDocumentAuditLogTypeSchema` enum (already located at lines 13–57 — append before the closing `]`):

```ts
  'FIELD_VALUE_CLEARED_CONDITIONAL',
  'FIELD_SKIPPED_CONDITIONAL',
  'FIELD_VISIBILITY_RULE_ADDED',
  'FIELD_VISIBILITY_RULE_REMOVED',
  'FIELD_VISIBILITY_RULE_MODIFIED',
```

- [ ] **Step 2: Extend the audit-log data discriminated union**

Locate the matching data schema union in `packages/lib/utils/document-audit-logs.ts` (or wherever the per-type data shapes are defined — typically in the same types file):

```bash
grep -n "FIELD_CREATED\\|createDocumentAuditLogData" packages/lib/utils/document-audit-logs.ts packages/lib/types/document-audit-logs.ts | head -20
```

Add new branches:

```ts
z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.FIELD_VALUE_CLEARED_CONDITIONAL),
  data: z.object({
    fieldId: z.string(),
    stableId: z.string(),
    previousValue: z.string(),
    triggerStableId: z.string(),
    triggerOldValue: z.string().optional(),
    triggerNewValue: z.string().optional(),
  }),
}),
z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.FIELD_SKIPPED_CONDITIONAL),
  data: z.object({
    fieldId: z.string(),
    stableId: z.string(),
    fieldLabel: z.string(),
    unmetRuleSummary: z.string(),
  }),
}),
z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.FIELD_VISIBILITY_RULE_ADDED),
  data: z.object({ fieldId: z.string(), ruleSnapshot: z.record(z.any()) }),
}),
z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.FIELD_VISIBILITY_RULE_REMOVED),
  data: z.object({ fieldId: z.string(), ruleSnapshot: z.record(z.any()) }),
}),
z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.FIELD_VISIBILITY_RULE_MODIFIED),
  data: z.object({
    fieldId: z.string(),
    before: z.record(z.any()),
    after: z.record(z.any()),
  }),
}),
```

- [ ] **Step 3: Visibility-aware required helper**

Append to `packages/lib/utils/advanced-fields-helpers.ts`:

```ts
import { evaluateAllVisibility } from '../universal/field-visibility';

/**
 * Whether the fields contain any required field that is both VISIBLE and not
 * yet inserted. Use this for completion gating instead of
 * fieldsContainUnsignedRequiredField.
 */
export const fieldsContainUnsignedRequiredVisibleField = (fields: Field[]) => {
  const visibility = evaluateAllVisibility(
    fields.map((f) => ({
      id: f.id,
      type: f.type,
      customText: f.customText,
      inserted: f.inserted,
      fieldMeta: f.fieldMeta,
    })),
  );

  return fields.some(
    (f) => isFieldUnsignedAndRequired(f) && visibility.get(f.id) !== false,
  );
};
```

- [ ] **Step 4: Use the new helper in completion flow**

In `packages/lib/server-only/document/complete-document-with-token.ts`, replace usage of `fieldsContainUnsignedRequiredField` with `fieldsContainUnsignedRequiredVisibleField`. Also add the sweep:

```ts
import { evaluateAllVisibility } from '@documenso/lib/universal/field-visibility';
import { fieldsContainUnsignedRequiredVisibleField } from '@documenso/lib/utils/advanced-fields-helpers';

// ... locate the block where recipient fields are loaded just before the
// `fieldsContainUnsignedRequiredField` check. Replace:
//   if (fieldsContainUnsignedRequiredField(fields))
// with:
//   if (fieldsContainUnsignedRequiredVisibleField(fields))
```

Then, after all required-field checks pass and before committing the completion, add the sweep block:

```ts
const visibility = evaluateAllVisibility(
  fields.map((f) => ({
    id: f.id, type: f.type, customText: f.customText, inserted: f.inserted, fieldMeta: f.fieldMeta,
  })),
);

const hiddenFields = fields.filter((f) => visibility.get(f.id) === false);

if (hiddenFields.length > 0) {
  await prisma.$transaction(async (tx) => {
    await tx.field.updateMany({
      where: { id: { in: hiddenFields.map((f) => f.id) } },
      data: { customText: '', inserted: false },
    });

    await tx.documentAuditLog.createMany({
      data: hiddenFields.map((f) => {
        const meta = f.fieldMeta as { stableId?: string; label?: string } | null;
        return createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_SKIPPED_CONDITIONAL,
          envelopeId: envelope.id,
          metadata: requestMetadata,
          data: {
            fieldId: f.secondaryId,
            stableId: meta?.stableId ?? '',
            fieldLabel: meta?.label ?? '',
            unmetRuleSummary: '', // populate via summarizer helper if available
          },
        });
      }),
    });
  });
}
```

- [ ] **Step 5: Type check + run tests**

```bash
cd packages/lib && npx tsc --noEmit && npm run test -- advanced-fields-helpers complete-document
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/lib/types/document-audit-logs.ts packages/lib/utils/document-audit-logs.ts packages/lib/utils/advanced-fields-helpers.ts packages/lib/server-only/document/complete-document-with-token.ts
git commit -m "feat(complete-document): visibility-aware required check + audit sweep"
```

---

### Task 11: Webhook payload excludes hidden fields

**Spec:** §6.4.

**Files:**
- Modify: the webhook payload serializer — likely `packages/lib/types/webhook-payload.ts` or `packages/lib/utils/webhook-payload.ts`.

- [ ] **Step 1: Locate the serializer**

```bash
grep -rn "mapEnvelopeToWebhookDocumentPayload\\|fields:.*fields.map" packages/lib/ --include='*.ts' | head -10
```

- [ ] **Step 2: Add visibility filter**

Inside the mapper where fields are serialized into the webhook payload, wrap the fields array:

```ts
import { evaluateAllVisibility } from '@documenso/lib/universal/field-visibility';

const visibility = evaluateAllVisibility(
  envelope.fields.map((f) => ({
    id: f.id, type: f.type, customText: f.customText, inserted: f.inserted, fieldMeta: f.fieldMeta,
  })),
);
const visibleFields = envelope.fields.filter((f) => visibility.get(f.id) !== false);

// ... use visibleFields instead of envelope.fields when serializing
```

- [ ] **Step 3: Type check**

```bash
cd packages/lib && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add packages/lib/types/webhook-payload.ts # (or the actual file path)
git commit -m "feat(webhooks): exclude hidden fields from document payload"
```

---

### Task 12: `delete` handlers reject dangling references (with `force`)

**Spec:** §5.6, §6.2 (delete).

**Files:**
- Modify: `packages/trpc/server/envelope-router/envelope-fields/delete-envelope-field.types.ts`
- Modify: `packages/trpc/server/envelope-router/envelope-fields/delete-envelope-field.ts`
- Modify: `packages/lib/server-only/field/delete-document-field.ts`
- Modify: `packages/lib/server-only/field/delete-template-field.ts`

- [ ] **Step 1: Extend the tRPC input schema**

In `delete-envelope-field.types.ts`, add `force`:

```ts
export const ZDeleteEnvelopeFieldRequestSchema = z.object({
  envelopeId: z.string(),
  fieldId: z.number(),
  force: z.boolean().optional().default(false).describe(
    'When true, proceed even if the field is referenced by other fields\' visibility rules. Dangling rules will be stripped.',
  ),
});
```

- [ ] **Step 2: Thread `force` to the server handler**

In `delete-envelope-field.ts` (the tRPC procedure), pass `force` through to the server-only function.

- [ ] **Step 3: Server-only logic**

In each of the two server-only delete handlers, before deletion:

```ts
const deletingMeta = field.fieldMeta as { stableId?: string } | null;
const deletingStableId = deletingMeta?.stableId;

if (deletingStableId) {
  const referencing = await prisma.field.findMany({
    where: {
      envelopeId: field.envelopeId,
      id: { not: field.id },
    },
    select: { id: true, fieldMeta: true },
  });

  const refs = referencing.filter((f) => {
    const meta = f.fieldMeta as { visibility?: { rules: Array<{ triggerFieldStableId: string }> } } | null;
    return meta?.visibility?.rules.some((r) => r.triggerFieldStableId === deletingStableId) ?? false;
  });

  if (refs.length > 0 && !options.force) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Field is used as a visibility trigger by other fields. Pass force=true to strip those rules.',
    });
  }

  if (refs.length > 0 && options.force) {
    // strip the dangling rules in the same transaction
    await prisma.$transaction(async (tx) => {
      for (const ref of refs) {
        const meta = ref.fieldMeta as { visibility: { rules: Array<{ triggerFieldStableId: string }>; match: 'all' | 'any' } } & Record<string, unknown>;
        const remaining = meta.visibility.rules.filter((r) => r.triggerFieldStableId !== deletingStableId);
        const newMeta = { ...meta };
        if (remaining.length === 0) {
          delete (newMeta as Record<string, unknown>).visibility;
        } else {
          newMeta.visibility = { ...meta.visibility, rules: remaining };
        }
        await tx.field.update({
          where: { id: ref.id },
          data: { fieldMeta: newMeta as unknown as any },
        });
      }
    });
  }
}
```

- [ ] **Step 4: Type check + existing tests still pass**

```bash
cd packages/lib && npx tsc --noEmit && npm run test -- delete-field
```

- [ ] **Step 5: Commit**

```bash
git add packages/trpc/server/envelope-router/envelope-fields/delete-envelope-field.ts packages/trpc/server/envelope-router/envelope-fields/delete-envelope-field.types.ts packages/lib/server-only/field/delete-document-field.ts packages/lib/server-only/field/delete-template-field.ts
git commit -m "feat(delete-field): reject dangling visibility refs; force-strip option"
```

---

### Task 13: Client-side visibility map in `EnvelopeSigningProvider`

**Spec:** §2.4, §4.3 (progress).

**Files:**
- Modify: `apps/remix/app/components/general/document-signing/envelope-signing-provider.tsx`

- [ ] **Step 1: Add visibility map and visible fields**

Open the provider. Find the existing `recipientFields` useMemo (around line 209). Add these new memos directly after it:

```ts
import { evaluateAllVisibility } from '@documenso/lib/universal/field-visibility';

// ... inside the component:

const recipientFieldVisibility = useMemo(() => {
  return evaluateAllVisibility(
    recipientFields.map((f) => ({
      id: f.id,
      type: f.type,
      customText: f.customText,
      inserted: f.inserted,
      fieldMeta: f.fieldMeta,
    })),
  );
}, [recipientFields]);

const visibleRecipientFields = useMemo(() => {
  return recipientFields.filter((f) => recipientFieldVisibility.get(f.id) !== false);
}, [recipientFields, recipientFieldVisibility]);
```

- [ ] **Step 2: Update `recipientFieldsRemaining` to honor visibility**

Around line 173, update the memo to filter out hidden fields:

```ts
const recipientFieldsRemaining = useMemo(() => {
  const requiredFields = envelopeData.recipient.fields
    .filter((field) => isFieldUnsignedAndRequired(field))
    // NEW:
    .filter((field) => recipientFieldVisibility.get(field.id) !== false);
  // ... existing ordering/filtering logic continues.
  return requiredFields;
}, [envelopeData, recipientFieldVisibility]);
```

- [ ] **Step 3: Expose `recipientFieldVisibility` and `visibleRecipientFields` via context value**

Add to the `EnvelopeSigningContextValue` type:

```ts
recipientFieldVisibility: Map<number, boolean>;
visibleRecipientFields: Field[];
```

And in the provider's `value={{ ... }}`:

```ts
recipientFieldVisibility,
visibleRecipientFields,
```

- [ ] **Step 4: Type check + dev smoke**

```bash
cd apps/remix && npx tsc --noEmit --project tsconfig.json
```

Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/remix/app/components/general/document-signing/envelope-signing-provider.tsx
git commit -m "feat(signing): visibility map in EnvelopeSigningProvider"
```

---

### Task 14: `useFieldVisibility` hook + `FieldRootContainer` hide

**Spec:** §2.4, §4.1 (fade transition), §4.7 (a11y).

**Files:**
- Create: `packages/ui/components/field/use-field-visibility.ts`
- Modify: `packages/ui/components/field/field.tsx`

- [ ] **Step 1: Create the hook**

Create `packages/ui/components/field/use-field-visibility.ts`:

```ts
import { useEnvelopeSigningContext } from '@documenso/remix/app/components/general/document-signing/envelope-signing-provider';

type FieldLike = { id: number };

/**
 * Returns `true` when the field has no recipient-signing context (i.e., we're
 * in the editor / preview) or when the evaluator reports the field visible.
 */
export const useFieldVisibility = (field: FieldLike): boolean => {
  const ctx = useEnvelopeSigningContext();
  if (!ctx) return true;
  return ctx.recipientFieldVisibility.get(field.id) !== false;
};
```

Note: the import path from `packages/ui` to `apps/remix` is unusual. If TypeScript complains, move the hook to `apps/remix/app/components/general/document-signing/use-field-visibility.ts` and have `field.tsx` consume it via a conditional import or prop. **Preferred path**: pass visibility as a prop from the signing flow. Update this task to use prop-passing if the cross-package import fails.

- [ ] **Step 2: Alternative approach (prop-passing) — use this instead**

Revise: Do NOT create the cross-package hook. Instead, extend `FieldRootContainer` in `packages/ui/components/field/field.tsx` to accept an optional `hidden` prop:

```tsx
type FieldRootContainerProps = {
  // ... existing props
  hidden?: boolean;
};

export const FieldRootContainer = ({ field, children, hidden, ...rest }: FieldRootContainerProps) => {
  if (hidden) return null;
  // ... existing body
};
```

Then update each consumer in `apps/remix/app/components/general/document-signing/` (signing-field components) to pass `hidden={recipientFieldVisibility.get(field.id) === false}`.

- [ ] **Step 3: Add fade transition styling**

In `FieldRootContainer`'s returned JSX, add:

```tsx
className={`${existing} transition-opacity duration-150`}
```

If the component already mounts/unmounts rather than toggling opacity, a transition won't fire. Keep the opacity transition in case future refactors mount-persist.

- [ ] **Step 4: Accessibility**

Fields that are hidden don't render at all (return null), so there's nothing in the DOM to be read. This satisfies `aria-hidden`. No further change needed unless signing-flow code wraps fields in persistent containers.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/components/field/field.tsx apps/remix/app/components/general/document-signing/
git commit -m "feat(signing): hide fields whose visibility rule is unmet"
```

---

### Task 15: ARIA-live announcement for newly-revealed fields

**Spec:** §4.7.

**Files:**
- Modify: `apps/remix/app/components/general/document-signing/envelope-signing-provider.tsx`

- [ ] **Step 1: Track visibility deltas**

Inside the provider, add:

```ts
import { useEffect, useRef, useState } from 'react';

// ... inside the component, after recipientFieldVisibility is computed:

const prevVisibilityRef = useRef<Map<number, boolean>>(new Map());
const [revealedFieldLabel, setRevealedFieldLabel] = useState<string | null>(null);

useEffect(() => {
  const prev = prevVisibilityRef.current;
  const newlyVisible = Array.from(recipientFieldVisibility.entries())
    .filter(([id, visible]) => visible && prev.get(id) === false);

  if (newlyVisible.length > 0) {
    const [firstId] = newlyVisible[0];
    const field = recipientFields.find((f) => f.id === firstId);
    const meta = field?.fieldMeta as { label?: string } | null;
    setRevealedFieldLabel(meta?.label ?? 'New required field');
  }
  prevVisibilityRef.current = new Map(recipientFieldVisibility);
}, [recipientFieldVisibility, recipientFields]);
```

- [ ] **Step 2: Render the live region**

In the provider's rendered JSX (inside `EnvelopeSigningContext.Provider`, alongside `{children}`):

```tsx
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
>
  {revealedFieldLabel ? `Field revealed: ${revealedFieldLabel}` : ''}
</div>
```

- [ ] **Step 3: Clear after announcement**

Add a `setTimeout` inside the effect to clear `revealedFieldLabel` after ~2s so subsequent reveals re-announce:

```ts
if (newlyVisible.length > 0) {
  // ... set label
  const timer = setTimeout(() => setRevealedFieldLabel(null), 2000);
  return () => clearTimeout(timer);
}
```

- [ ] **Step 4: Type check**

```bash
cd apps/remix && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/remix/app/components/general/document-signing/envelope-signing-provider.tsx
git commit -m "feat(signing): aria-live announcement for revealed fields"
```

---

### Task 16: Reusable `<VisibilitySection>` component

**Spec:** §3.1–§3.5, §3.7.

**Files:**
- Create: `packages/ui/primitives/document-flow/field-items-advanced-settings/visibility-section.tsx`

- [ ] **Step 1: Implement the component**

Create the file with this content (use existing Documenso primitives like `Select`, `Input`, `Button`, `Label`):

```tsx
import { useMemo } from 'react';

import { FieldType } from '@prisma/client';
import { Trans } from '@lingui/react/macro';
import { PlusIcon, TrashIcon } from 'lucide-react';

import type { TVisibilityBlock, TVisibilityRule } from '@documenso/lib/types/field-meta';
import { Button } from '../../button';
import { Input } from '../../input';
import { Label } from '../../label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../select';

type EligibleTriggerField = {
  id: number;
  type: FieldType;
  stableId?: string;
  label?: string;
  page?: number;
  values?: Array<{ value: string }>;
};

type Props = {
  /** The field being edited. */
  currentFieldId: number | null;
  currentFieldType: FieldType;
  /** All same-recipient fields available as triggers. */
  triggerCandidates: EligibleTriggerField[];
  value: TVisibilityBlock | undefined;
  onChange: (next: TVisibilityBlock | undefined) => void;
};

const OPERATORS_BY_TYPE: Record<FieldType, Array<TVisibilityRule['operator']>> = {
  [FieldType.RADIO]: ['equals', 'notEquals', 'isEmpty', 'isNotEmpty'],
  [FieldType.DROPDOWN]: ['equals', 'notEquals', 'isEmpty', 'isNotEmpty'],
  [FieldType.CHECKBOX]: ['contains', 'notContains', 'isEmpty', 'isNotEmpty'],
  [FieldType.TEXT]: ['equals', 'notEquals', 'contains', 'isEmpty', 'isNotEmpty'],
} as Partial<Record<FieldType, Array<TVisibilityRule['operator']>>> as Record<FieldType, Array<TVisibilityRule['operator']>>;

const OPERATOR_LABELS: Record<TVisibilityRule['operator'], string> = {
  equals: 'equals',
  notEquals: 'does not equal',
  contains: 'contains',
  notContains: 'does not contain',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
};

const labelForTrigger = (t: EligibleTriggerField, idx: number) =>
  t.label?.trim()
    ? `${t.label} · ${t.type.toLowerCase()} · p.${t.page ?? 1}`
    : `Unnamed ${t.type.toLowerCase()} #${idx + 1}`;

export const VisibilitySection = ({
  currentFieldId,
  currentFieldType,
  triggerCandidates,
  value,
  onChange,
}: Props) => {
  const eligibleTriggers = useMemo(() => {
    return triggerCandidates
      .filter((t) => [FieldType.RADIO, FieldType.CHECKBOX, FieldType.DROPDOWN, FieldType.TEXT].includes(t.type))
      .filter((t) => t.id !== currentFieldId);
  }, [triggerCandidates, currentFieldId]);

  const rules = value?.rules ?? [];

  const updateRule = (index: number, patch: Partial<TVisibilityRule>) => {
    const next = [...rules];
    next[index] = { ...next[index], ...patch } as TVisibilityRule;
    onChange({ match: value?.match ?? 'all', rules: next });
  };

  const addRule = () => {
    const firstTrigger = eligibleTriggers[0];
    if (!firstTrigger || !firstTrigger.stableId) {
      onChange(undefined);
      return;
    }
    const newRule: TVisibilityRule = {
      operator: 'equals',
      triggerFieldStableId: firstTrigger.stableId,
      value: '',
    };
    onChange({ match: value?.match ?? 'all', rules: [...rules, newRule] });
  };

  const removeRule = (index: number) => {
    const next = rules.filter((_, i) => i !== index);
    onChange(next.length === 0 ? undefined : { match: value?.match ?? 'all', rules: next });
  };

  return (
    <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
      <Label className="text-sm font-semibold">
        <Trans>Visibility</Trans>
      </Label>

      {eligibleTriggers.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          <Trans>Add a radio, checkbox, dropdown, or text field to the same recipient to use visibility rules.</Trans>
        </p>
      )}

      {rules.length >= 2 && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <Button
            variant={value?.match === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange({ match: 'all', rules })}
          >
            <Trans>Match ALL</Trans>
          </Button>
          <Button
            variant={value?.match === 'any' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange({ match: 'any', rules })}
          >
            <Trans>Match ANY</Trans>
          </Button>
        </div>
      )}

      <div className="mt-2 space-y-2">
        {rules.map((rule, index) => {
          const trigger = eligibleTriggers.find((t) => t.stableId === rule.triggerFieldStableId);
          const operators = trigger ? OPERATORS_BY_TYPE[trigger.type] : [];
          const needsValue = rule.operator !== 'isEmpty' && rule.operator !== 'isNotEmpty';
          const isTextTrigger = trigger?.type === FieldType.TEXT;
          const enumOptions = !isTextTrigger ? (trigger?.values ?? []) : null;

          return (
            <div key={index} className="flex flex-wrap items-center gap-2 rounded border bg-background p-2">
              <Select
                value={rule.triggerFieldStableId}
                onValueChange={(v) => updateRule(index, { triggerFieldStableId: v })}
              >
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {eligibleTriggers.map((t, i) => (
                    <SelectItem key={t.id} value={t.stableId ?? `__noid_${t.id}`}>
                      {labelForTrigger(t, i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={rule.operator}
                onValueChange={(op) =>
                  op === 'isEmpty' || op === 'isNotEmpty'
                    ? updateRule(index, { operator: op as any, value: undefined } as any)
                    : updateRule(index, { operator: op as any } as any)
                }
              >
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {needsValue && enumOptions && (
                <Select
                  value={(rule as any).value ?? ''}
                  onValueChange={(v) => updateRule(index, { value: v } as any)}
                >
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {enumOptions.map((o, i) => (
                      <SelectItem key={i} value={o.value}>{o.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {needsValue && isTextTrigger && (
                <Input
                  className="w-40"
                  value={(rule as any).value ?? ''}
                  onChange={(e) => updateRule(index, { value: e.target.value } as any)}
                />
              )}

              <Button variant="ghost" size="sm" onClick={() => removeRule(index)} aria-label="Remove rule">
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={addRule}
          disabled={eligibleTriggers.length === 0}
        >
          <PlusIcon className="mr-1 h-4 w-4" />
          <Trans>Add rule</Trans>
        </Button>
      </div>

      {rules.some((r) => {
        const t = eligibleTriggers.find((tt) => tt.stableId === (r as any).triggerFieldStableId);
        return t?.type === FieldType.TEXT;
      }) && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          <Trans>Text matching is case-insensitive and ignores leading/trailing whitespace.</Trans>
        </p>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Type check**

```bash
cd packages/ui && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/primitives/document-flow/field-items-advanced-settings/visibility-section.tsx
git commit -m "feat(ui): reusable VisibilitySection for advanced-settings panel"
```

---

### Task 17: Mount `<VisibilitySection>` in the 5 eligible per-type panels

**Spec:** §3.1 (placement), dependent-eligible types.

**Files:**
- Modify: `packages/ui/primitives/document-flow/field-items-advanced-settings/text-field.tsx`
- Modify: `packages/ui/primitives/document-flow/field-items-advanced-settings/number-field.tsx`
- Modify: `packages/ui/primitives/document-flow/field-items-advanced-settings/radio-field.tsx`
- Modify: `packages/ui/primitives/document-flow/field-items-advanced-settings/checkbox-field.tsx`
- Modify: `packages/ui/primitives/document-flow/field-items-advanced-settings/dropdown-field.tsx`

- [ ] **Step 1: Thread trigger-candidate data down from the parent**

Look at the parent `field-item-advanced-settings.tsx` to see the `fields` prop (around line 264):

```bash
grep -n "fields:" packages/ui/primitives/document-flow/field-item-advanced-settings.tsx | head -5
```

Currently the parent has access to `fields` (same-envelope field list). Thread this as a prop into each per-type panel.

Add to each panel's props:

```ts
type Props = {
  fieldState: ...;
  handleFieldChange: ...;
  handleErrors: ...;
  // NEW:
  sameRecipientFields?: Array<{
    id: number;
    type: FieldType;
    recipientId: number;
    fieldMeta: unknown;
    page?: number;
  }>;
  currentFieldId?: number | null;
};
```

- [ ] **Step 2: Render `<VisibilitySection>` at the bottom of each panel**

At the end of each per-type panel's returned JSX, before the closing container:

```tsx
import { VisibilitySection } from './visibility-section';

// ...
<VisibilitySection
  currentFieldId={currentFieldId ?? null}
  currentFieldType={FieldType.TEXT} // replace with the correct type per panel
  triggerCandidates={(sameRecipientFields ?? []).map((f) => {
    const meta = f.fieldMeta as { stableId?: string; label?: string } | null;
    return {
      id: f.id,
      type: f.type,
      stableId: meta?.stableId,
      label: meta?.label,
      page: f.page,
      values: (f.fieldMeta as any)?.values,
    };
  })}
  value={(fieldState as any).visibility}
  onChange={(next) => handleFieldChange('visibility', next as any)}
/>
```

- [ ] **Step 3: Update the parent to pass the new props**

In `field-item-advanced-settings.tsx` (around lines 278–343), pass to each `<*FieldAdvancedSettings>` the additional props:

```tsx
<TextFieldAdvancedSettings
  fieldState={fieldState}
  handleFieldChange={handleFieldChange}
  handleErrors={setErrors}
  currentFieldId={field.nativeId ?? null}
  sameRecipientFields={fields.filter((f) => f.recipientId === field.recipientId && f.nativeId !== field.nativeId)}
/>
```

(Use the actual prop names exposed by the parent — likely `field.nativeId`, but verify with `grep -n "nativeId\\|formId" packages/ui/primitives/document-flow/field-item-advanced-settings.tsx`.)

- [ ] **Step 4: Type check**

```bash
cd packages/ui && npx tsc --noEmit
```

- [ ] **Step 5: Manual smoke**

Start dev server:

```bash
npm run dev
```

Visit `http://localhost:3000`. Create a template with a radio and a text field. Click the text field → advanced settings → confirm the "Visibility" section appears at the bottom of the panel.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/primitives/document-flow/field-item-advanced-settings.tsx packages/ui/primitives/document-flow/field-items-advanced-settings/text-field.tsx packages/ui/primitives/document-flow/field-items-advanced-settings/number-field.tsx packages/ui/primitives/document-flow/field-items-advanced-settings/radio-field.tsx packages/ui/primitives/document-flow/field-items-advanced-settings/checkbox-field.tsx packages/ui/primitives/document-flow/field-items-advanced-settings/dropdown-field.tsx
git commit -m "feat(editor): mount VisibilitySection in all eligible field panels"
```

---

### Task 18: Canvas indicator glyph

**Spec:** §3.6.

**Files:**
- Modify: `packages/ui/primitives/document-flow/field-item.tsx` (the draggable/positioned field chip on the canvas)

- [ ] **Step 1: Locate the render path**

```bash
grep -n "return\\|FieldIcon\\|className=" packages/ui/primitives/document-flow/field-item.tsx | head -20
```

- [ ] **Step 2: Add the glyph**

Near the top-right corner of the field's absolute-positioned container, add:

```tsx
import { EyeIcon } from 'lucide-react';

// Inside the field chip's JSX:
{(() => {
  const meta = field.fieldMeta as { visibility?: unknown } | null;
  if (!meta?.visibility) return null;
  return (
    <div
      className="absolute -right-1 -top-1 rounded-full bg-primary/90 p-0.5 text-primary-foreground shadow"
      title="This field has conditional visibility"
    >
      <EyeIcon className="h-3 w-3" />
    </div>
  );
})()}
```

- [ ] **Step 3: Manual smoke**

Start dev server. Place a text field on a template with a visibility rule. Confirm the eye icon appears in the corner.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/primitives/document-flow/field-item.tsx
git commit -m "feat(editor): canvas glyph indicates fields with visibility rules"
```

---

### Task 19: Editor audit events for rule add/remove/modify

**Spec:** §7.1 (editor-side events on documents only).

**Files:**
- Modify: `packages/lib/server-only/field/update-envelope-fields.ts` (where document-level FIELD_UPDATED is emitted)

- [ ] **Step 1: Locate the existing FIELD_UPDATED audit emission**

```bash
grep -n "FIELD_UPDATED\\|documentAuditLog.createMany" packages/lib/server-only/field/update-envelope-fields.ts
```

- [ ] **Step 2: Diff `visibility` before/after the update**

Inside the transaction, after loading `existingField` and receiving `incomingField`:

```ts
import { isDeepEqual } from 'remeda';

const prevMeta = existingField.fieldMeta as { visibility?: unknown } | null;
const nextMeta = incomingField.fieldMeta as { visibility?: unknown } | null;
const prevVis = prevMeta?.visibility ?? null;
const nextVis = nextMeta?.visibility ?? null;

if (envelope.type === EnvelopeType.DOCUMENT && !isDeepEqual(prevVis, nextVis)) {
  const type = prevVis === null
    ? DOCUMENT_AUDIT_LOG_TYPE.FIELD_VISIBILITY_RULE_ADDED
    : nextVis === null
      ? DOCUMENT_AUDIT_LOG_TYPE.FIELD_VISIBILITY_RULE_REMOVED
      : DOCUMENT_AUDIT_LOG_TYPE.FIELD_VISIBILITY_RULE_MODIFIED;

  auditLogsToCreate.push(
    createDocumentAuditLogData({
      type,
      envelopeId: envelope.id,
      metadata: requestMetadata,
      data: type === DOCUMENT_AUDIT_LOG_TYPE.FIELD_VISIBILITY_RULE_MODIFIED
        ? { fieldId: existingField.secondaryId, before: prevVis, after: nextVis }
        : { fieldId: existingField.secondaryId, ruleSnapshot: (type === DOCUMENT_AUDIT_LOG_TYPE.FIELD_VISIBILITY_RULE_ADDED ? nextVis : prevVis) },
    }),
  );
}
```

- [ ] **Step 3: Type check**

```bash
cd packages/lib && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add packages/lib/server-only/field/update-envelope-fields.ts
git commit -m "feat(audit): emit visibility rule add/remove/modify events on documents"
```

---

### Task 20: Signing certificate lists skipped conditional fields

**Spec:** §7.2.

**Files:**
- Modify: the signing-certificate renderer. Locate first:

```bash
grep -rn "Signing certificate\\|signing-certificate\\|signature.*cert" packages/lib apps/remix packages/ui --include='*.ts' --include='*.tsx' | head -10
```

Expected candidates: `packages/lib/server-only/pdf/**` or `packages/ui/pdf/**`.

- [ ] **Step 1: Find the renderer**

Use the grep above to locate. Common files: something like `build-signing-certificate.ts` or a React component for a PDF template.

- [ ] **Step 2: Add a per-recipient skipped-fields section**

Pull audit-log entries with `type: FIELD_SKIPPED_CONDITIONAL` for this envelope. Group by recipient. Render:

```
Fields not signed due to conditional visibility:
  • {fieldLabel or type} — not shown because {unmetRuleSummary}
```

Write a helper `summarizeUnmetRules(visibilityBlock, recipientFields): string` that produces user-friendly text. Add it to `packages/lib/universal/field-visibility/summarize.ts`:

```ts
export const summarizeUnmetRules = (
  block: { match: 'all' | 'any'; rules: Array<{ operator: string; triggerFieldStableId: string; value?: string }> },
  stableIdToLabel: Map<string, string>,
): string => {
  const parts = block.rules.map((r) => {
    const label = stableIdToLabel.get(r.triggerFieldStableId) ?? 'a required field';
    switch (r.operator) {
      case 'equals': return `${label} was not "${r.value}"`;
      case 'notEquals': return `${label} was "${r.value}"`;
      case 'contains': return `${label} did not contain "${r.value}"`;
      case 'notContains': return `${label} contained "${r.value}"`;
      case 'isEmpty': return `${label} was not empty`;
      case 'isNotEmpty': return `${label} was empty`;
      default: return '';
    }
  }).filter(Boolean);
  const join = block.match === 'all' ? ' and ' : ' or ';
  return parts.join(join);
};
```

Use `summarizeUnmetRules` at Task 10 Step 4's sweep site to populate `unmetRuleSummary` in the audit entry, then the certificate renderer reads that string directly.

- [ ] **Step 3: Manual smoke**

Build and sign a test document with a hidden field. Download the signing certificate PDF and verify the skipped-fields section appears.

- [ ] **Step 4: Commit**

```bash
git add packages/lib/universal/field-visibility/summarize.ts packages/lib/server-only/document/complete-document-with-token.ts <certificate-renderer-path>
git commit -m "feat(certificate): list conditionally skipped fields"
```

---

### Task 21: End-to-end Playwright spec

**Spec:** Whole design, §4 (signing UX), §7 (audit).

**Files:**
- Create: `packages/app-tests/e2e/templates/conditional-field-visibility.spec.ts`

- [ ] **Step 1: Scaffold the spec**

Create `packages/app-tests/e2e/templates/conditional-field-visibility.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';
import { createTemplate } from '../fixtures/templates';

test.describe('Conditional field visibility', () => {
  test('hidden field does not block completion; appears when condition is met', async ({ page }) => {
    await apiSignin({ page, email: 'testuser@documenso.com' });

    // Create template with a radio (trigger) and a text field (dependent).
    // Configure visibility so text shows only when radio = "Married".
    const { templateId } = await createTemplate({ page, title: 'Conditional test' });

    // Navigate to template editor. Add a radio field with "Married"/"Single".
    await page.goto(`/templates/${templateId}/edit`);
    // ... (use the existing editor fixtures to drop fields; implementation-specific)

    // Open advanced settings on the text field, add visibility rule:
    //   trigger = radio, operator = equals, value = Married
    // Save template.

    // Use template to create a document, send to self, sign.
    // Verify: text field not visible until radio is "Married".
    // Verify: if radio is "Single", completion succeeds WITHOUT filling text field.
  });

  test('webhook payload excludes hidden fields', async () => {
    // Mock webhook endpoint, complete a document, assert the `fields` array
    // omits the hidden field.
  });

  test('signing certificate lists skipped conditional fields', async () => {
    // Complete a doc, download certificate, assert it contains
    // "not shown because ..."
  });
});
```

Fill in the specific selectors and interactions based on existing Playwright fixtures under `packages/app-tests/e2e/`. Test implementation is expected to take 1-2 hours given the scaffolding Documenso already has.

- [ ] **Step 2: Run**

```bash
cd packages/app-tests && npm run test:e2e -- conditional-field-visibility
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/app-tests/e2e/templates/conditional-field-visibility.spec.ts
git commit -m "test(e2e): conditional field visibility end-to-end"
```

---

## Self-review notes

**Spec coverage check:**
- §1 Data model → Tasks 1, 6 ✓
- §2 Evaluator → Tasks 2, 3, 9, 10 ✓
- §3 Editor UX → Tasks 16, 17, 18 ✓
- §4 Signing UX → Tasks 13, 14, 15 ✓
- §5 Validation → Tasks 4, 7, 8 ✓
- §6 API surface → Tasks 5, 7, 8, 9, 12 ✓
- §7 Audit & cert → Tasks 10, 19, 20 ✓

**Deferred / relies on discovery during implementation:**
- Exact path of `AppErrorCode` enum (Task 5 Step 1 looks it up).
- Exact path of webhook payload serializer (Task 11 Step 1 looks it up).
- Exact path of the signing-certificate renderer (Task 20 Step 1 looks it up).

**Known fragility:**
- Task 14 has a fallback plan (prop-passing) because of the packages/ui → apps/remix import problem. Reader should use the prop-passing variant.
