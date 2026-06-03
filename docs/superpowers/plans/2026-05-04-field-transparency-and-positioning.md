# Field Transparency and Per-Item Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make checkbox/radio fields transparent over document text and allow per-item offset positioning within groups.

**Architecture:** Three independent changes: (1) conditional CSS in FieldRootContainer for checkbox/radio transparency, (2) schema + editor + signing view changes for per-item offsetX/offsetY positioning, (3) groupId scaffolding on ZBaseFieldMeta. All schema changes are additive with no DB migration.

**Tech Stack:** React, Tailwind CSS, Zod schemas, vitest, TypeScript

**Spec:** `docs/superpowers/specs/2026-05-04-field-transparency-and-positioning-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `packages/lib/types/field-meta.ts` | Add offsetX/offsetY to value items, 'custom' direction, groupId to base |
| Modify | `packages/ui/components/field/field.tsx` | Conditional transparent styling for checkbox/radio in FieldRootContainer |
| Modify | `packages/ui/primitives/document-flow/field-content.tsx` | Offset-aware rendering in read-only/editor preview |
| Modify | `apps/remix/app/components/general/document-signing/document-signing-checkbox-field.tsx` | Offset-aware rendering in signing view |
| Modify | `apps/remix/app/components/general/document-signing/document-signing-radio-field.tsx` | Offset-aware rendering in signing view |
| Modify | `apps/remix/app/components/forms/editor/editor-field-checkbox-form.tsx` | Direction enum sync, offset inputs UI |
| Modify | `apps/remix/app/components/forms/editor/editor-field-radio-form.tsx` | Direction enum sync, offset inputs UI |
| Create | `packages/lib/types/field-meta.test.ts` | Unit tests for schema changes |

---

### Task 1: Schema Changes (field-meta.ts)

**Files:**
- Create: `packages/lib/types/field-meta.test.ts`
- Modify: `packages/lib/types/field-meta.ts`

- [ ] **Step 1: Write failing tests for the schema changes**

```typescript
// ABOUTME: Unit tests for field-meta Zod schema changes.
// ABOUTME: Covers offsetX/offsetY bounds, custom direction, groupId constraints.
import { describe, expect, it } from 'vitest';

import {
  ZBaseFieldMeta,
  ZCheckboxFieldMeta,
  ZRadioFieldMeta,
} from './field-meta';

describe('ZBaseFieldMeta groupId', () => {
  it('accepts a valid groupId', () => {
    const result = ZBaseFieldMeta.safeParse({ groupId: 'group-1_test' });
    expect(result.success).toBe(true);
  });

  it('rejects groupId longer than 64 characters', () => {
    const result = ZBaseFieldMeta.safeParse({ groupId: 'a'.repeat(65) });
    expect(result.success).toBe(false);
  });

  it('rejects groupId with invalid characters', () => {
    const result = ZBaseFieldMeta.safeParse({ groupId: 'group id with spaces!' });
    expect(result.success).toBe(false);
  });

  it('accepts missing groupId (backward compat)', () => {
    const result = ZBaseFieldMeta.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('ZCheckboxFieldMeta offsets', () => {
  const baseCheckbox = { type: 'checkbox' as const };

  it('accepts values with valid offsets', () => {
    const result = ZCheckboxFieldMeta.safeParse({
      ...baseCheckbox,
      values: [{ id: 1, checked: false, value: 'Option A', offsetX: 10, offsetY: -5 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects offsetX above 100', () => {
    const result = ZCheckboxFieldMeta.safeParse({
      ...baseCheckbox,
      values: [{ id: 1, checked: false, value: 'A', offsetX: 101 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects offsetY below -100', () => {
    const result = ZCheckboxFieldMeta.safeParse({
      ...baseCheckbox,
      values: [{ id: 1, checked: false, value: 'A', offsetY: -101 }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts values without offsets (backward compat)', () => {
    const result = ZCheckboxFieldMeta.safeParse({
      ...baseCheckbox,
      values: [{ id: 1, checked: false, value: 'A' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts custom direction', () => {
    const result = ZCheckboxFieldMeta.safeParse({
      ...baseCheckbox,
      direction: 'custom',
    });
    expect(result.success).toBe(true);
  });

  it('defaults direction to vertical', () => {
    const result = ZCheckboxFieldMeta.parse(baseCheckbox);
    expect(result.direction).toBe('vertical');
  });
});

describe('ZRadioFieldMeta offsets', () => {
  const baseRadio = { type: 'radio' as const };

  it('accepts values with valid offsets', () => {
    const result = ZRadioFieldMeta.safeParse({
      ...baseRadio,
      values: [{ id: 1, checked: false, value: 'Option A', offsetX: 50, offsetY: 25 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects out-of-bounds offsets', () => {
    const result = ZRadioFieldMeta.safeParse({
      ...baseRadio,
      values: [{ id: 1, checked: false, value: 'A', offsetX: 200 }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts custom direction', () => {
    const result = ZRadioFieldMeta.safeParse({
      ...baseRadio,
      direction: 'custom',
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/lib && bunx vitest run types/field-meta.test.ts --project unit`
Expected: FAIL (groupId not on schema, offsetX/offsetY not on value items, 'custom' not in direction enum)

- [ ] **Step 3: Add groupId to ZBaseFieldMeta**

In `packages/lib/types/field-meta.ts`, change `ZBaseFieldMeta`:

```typescript
export const ZBaseFieldMeta = z.object({
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  fontSize: z.number().min(8).max(96).default(DEFAULT_FIELD_FONT_SIZE).optional(),
  groupId: z.string().max(64).regex(/^[a-zA-Z0-9_-]+$/).optional(),
});
```

- [ ] **Step 4: Add offsetX/offsetY to checkbox and radio value schemas, add 'custom' direction**

In `packages/lib/types/field-meta.ts`, update `ZRadioFieldMeta`:

```typescript
export const ZRadioFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('radio'),
  values: z
    .array(
      z.object({
        id: z.number(),
        checked: z.boolean(),
        value: z.string(),
        offsetX: z.number().min(-100).max(100).optional(),
        offsetY: z.number().min(-100).max(100).optional(),
      }),
    )
    .optional(),
  direction: z.enum(['vertical', 'horizontal', 'custom']).optional().default('vertical'),
});
```

Apply the same changes to `ZCheckboxFieldMeta`:

```typescript
export const ZCheckboxFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('checkbox'),
  values: z
    .array(
      z.object({
        id: z.number(),
        checked: z.boolean(),
        value: z.string(),
        offsetX: z.number().min(-100).max(100).optional(),
        offsetY: z.number().min(-100).max(100).optional(),
      }),
    )
    .optional(),
  validationRule: z.string().optional(),
  validationLength: z.number().optional(),
  direction: z.enum(['vertical', 'horizontal', 'custom']).optional().default('vertical'),
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/lib && bunx vitest run types/field-meta.test.ts --project unit`
Expected: all tests PASS

- [ ] **Step 6: Type check**

Run: `npx -p typescript tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add packages/lib/types/field-meta.ts packages/lib/types/field-meta.test.ts
git commit -m "feat: add offsetX/offsetY to checkbox/radio schema, groupId to base"
```

---

### Task 2: Field Transparency in FieldRootContainer

**Files:**
- Modify: `packages/ui/components/field/field.tsx`

- [ ] **Step 1: Add conditional transparency for checkbox/radio fields**

In `packages/ui/components/field/field.tsx`, update the `FieldRootContainer` component. Replace the `className` on the container div (around line 139-148):

```typescript
return (
    <FieldContainerPortal field={field}>
      <div
        id={`field-${field.id}`}
        ref={ref}
        data-field-type={field.type}
        data-inserted={field.inserted ? 'true' : 'false'}
        data-readonly={readonly ? 'true' : 'false'}
        className={cn(
          'field--FieldRootContainer field-card-container dark-mode-disabled group relative z-20 flex h-full w-full items-center rounded-[2px] transition-all',
          field.type === FieldType.CHECKBOX || field.type === FieldType.RADIO
            ? 'bg-transparent ring-1 ring-opacity-40'
            : 'bg-white/90 ring-2 ring-gray-200',
          color?.base,
          {
            'px-2': field.type !== FieldType.SIGNATURE && field.type !== FieldType.FREE_SIGNATURE,
            'justify-center': !field.inserted,
            'ring-orange-300': isValidating && isFieldUnsignedAndRequired(field),
          },
          className,
        )}
      >
        {children}
      </div>
    </FieldContainerPortal>
  );
```

The key change: the base styles `bg-white/90 ring-2 ring-gray-200` are now conditional. Checkbox/radio fields get `bg-transparent ring-1 ring-opacity-40` instead.

- [ ] **Step 2: Type check**

Run: `npx -p typescript tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/ui/components/field/field.tsx
git commit -m "feat: transparent background for checkbox/radio fields in signing view"
```

---

### Task 3: Offset-Aware Rendering in Signing View (Checkbox)

**Files:**
- Modify: `apps/remix/app/components/general/document-signing/document-signing-checkbox-field.tsx`

- [ ] **Step 1: Add offset-aware rendering to the unsigned checkbox view**

In `document-signing-checkbox-field.tsx`, replace the unsigned rendering block (the `{!field.inserted && (...)}` section, around lines 273-312). Add a helper to detect custom positioning and a function to compute item styles:

After the `parsedFieldMeta` declaration (around line 49), add:

```typescript
const useCustomPositioning = parsedFieldMeta.direction === 'custom' &&
  values?.every((item) => item.offsetX !== undefined && item.offsetY !== undefined);
```

Then update both the unsigned and inserted rendering blocks. Replace the outer `<div>` wrapper in each. For the **unsigned** block (around line 280):

```typescript
{!field.inserted && (
  <>
    {!isLengthConditionMet && (
      <FieldToolTip key={field.id} field={field} color="warning" className="">
        {validationSign?.label} {checkboxValidationLength}
      </FieldToolTip>
    )}
    <div
      className={cn(
        'z-50 my-0.5',
        useCustomPositioning
          ? 'relative'
          : cn(
              'flex gap-1',
              parsedFieldMeta.direction === 'horizontal'
                ? 'flex-row flex-wrap'
                : 'flex-col gap-y-1',
            ),
      )}
    >
      {values?.map((item: { id: number; value: string; checked: boolean; offsetX?: number; offsetY?: number }, index: number) => {
        const itemValue = item.value || `empty-value-${item.id}`;

        return (
          <div
            key={index}
            className="flex items-center"
            style={
              useCustomPositioning && item.offsetX !== undefined && item.offsetY !== undefined
                ? {
                    position: 'absolute',
                    left: `${item.offsetX}%`,
                    top: `${item.offsetY}%`,
                  }
                : undefined
            }
          >
            <Checkbox
              className="h-3 w-3"
              id={`checkbox-${field.id}-${item.id}`}
              checked={checkedValues.includes(itemValue)}
              disabled={isReadOnly}
              onCheckedChange={() => handleCheckboxChange(item.value, item.id)}
            />
            {!item.value.includes('empty-value-') && item.value && (
              <Label
                htmlFor={`checkbox-${field.id}-${item.id}`}
                className="text-foreground ml-1.5 text-xs font-normal"
              >
                {item.value}
              </Label>
            )}
          </div>
        );
      })}
    </div>
  </>
)}
```

- [ ] **Step 2: Apply the same pattern to the inserted (signed) block**

The `{field.inserted && (...)}` section (around lines 315-347) needs the same changes. Replace it with:

```typescript
{field.inserted && (
  <div
    className={cn(
      'my-0.5',
      useCustomPositioning
        ? 'relative'
        : cn(
            'flex gap-1',
            parsedFieldMeta.direction === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col gap-y-1',
          ),
    )}
  >
    {values?.map((item: { id: number; value: string; checked: boolean; offsetX?: number; offsetY?: number }, index: number) => {
      const itemValue = item.value || `empty-value-${item.id}`;

      return (
        <div
          key={index}
          className="flex items-center"
          style={
            useCustomPositioning && item.offsetX !== undefined && item.offsetY !== undefined
              ? {
                  position: 'absolute',
                  left: `${item.offsetX}%`,
                  top: `${item.offsetY}%`,
                }
              : undefined
          }
        >
          <Checkbox
            className="h-3 w-3"
            id={`checkbox-${field.id}-${item.id}`}
            checked={parsedCheckedValues.includes(itemValue)}
            disabled={isLoading || isReadOnly}
            onCheckedChange={() => void handleCheckboxOptionClick(item)}
          />
          {!item.value.includes('empty-value-') && item.value && (
            <Label
              htmlFor={`checkbox-${field.id}-${item.id}`}
              className="text-foreground ml-1.5 text-xs font-normal"
            >
              {item.value}
            </Label>
          )}
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 3: Type check**

Run: `npx -p typescript tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/remix/app/components/general/document-signing/document-signing-checkbox-field.tsx
git commit -m "feat: offset-aware rendering for checkbox fields in signing view"
```

---

### Task 4: Offset-Aware Rendering in Signing View (Radio)

**Files:**
- Modify: `apps/remix/app/components/general/document-signing/document-signing-radio-field.tsx`

- [ ] **Step 1: Add offset-aware rendering to radio field**

In `document-signing-radio-field.tsx`, after `parsedFieldMeta` (around line 44), add:

```typescript
const useCustomPositioning = parsedFieldMeta.direction === 'custom' &&
  values?.every((item) => item.offsetX !== undefined && item.offsetY !== undefined);
```

Replace the **unsigned** `RadioGroup` block (around lines 158-187):

```typescript
{!field.inserted && (
  <RadioGroup
    onValueChange={(value) => handleSelectItem(value)}
    className={cn(
      'z-10 my-0.5 gap-1',
      useCustomPositioning
        ? 'relative'
        : cn(
            parsedFieldMeta.direction === 'horizontal'
              ? 'flex flex-row flex-wrap'
              : 'flex flex-col gap-y-1',
          ),
    )}
  >
    {values?.map((item, index) => (
      <div
        key={index}
        className="flex items-center"
        style={
          useCustomPositioning && item.offsetX !== undefined && item.offsetY !== undefined
            ? {
                position: 'absolute',
                left: `${item.offsetX}%`,
                top: `${item.offsetY}%`,
              }
            : undefined
        }
      >
        <RadioGroupItem
          className="h-3 w-3 shrink-0"
          value={item.value}
          id={`option-${field.id}-${item.id}`}
          checked={item.checked}
          disabled={isReadOnly}
        />
        {!item.value.includes('empty-value-') && item.value && (
          <Label
            htmlFor={`option-${field.id}-${item.id}`}
            className="text-foreground ml-1.5 text-xs font-normal"
          >
            {item.value}
          </Label>
        )}
      </div>
    ))}
  </RadioGroup>
)}
```

- [ ] **Step 2: Apply the same to the inserted (signed) radio block**

Replace the inserted `RadioGroup` block (around lines 189-218) with the same pattern. The only difference: no `onValueChange` handler, and `checked` uses `item.value === field.customText`:

```typescript
{field.inserted && (
  <RadioGroup
    className={cn(
      'my-0.5 gap-1',
      useCustomPositioning
        ? 'relative'
        : cn(
            parsedFieldMeta.direction === 'horizontal'
              ? 'flex flex-row flex-wrap'
              : 'flex flex-col gap-y-1',
          ),
    )}
  >
    {values?.map((item, index) => (
      <div
        key={index}
        className="flex items-center"
        style={
          useCustomPositioning && item.offsetX !== undefined && item.offsetY !== undefined
            ? {
                position: 'absolute',
                left: `${item.offsetX}%`,
                top: `${item.offsetY}%`,
              }
            : undefined
        }
      >
        <RadioGroupItem
          className="h-3 w-3"
          value={item.value}
          id={`option-${field.id}-${item.id}`}
          checked={item.value === field.customText}
          disabled={isReadOnly}
        />
        {!item.value.includes('empty-value-') && item.value && (
          <Label
            htmlFor={`option-${field.id}-${item.id}`}
            className="text-foreground ml-1.5 text-xs font-normal"
          >
            {item.value}
          </Label>
        )}
      </div>
    ))}
  </RadioGroup>
)}
```

- [ ] **Step 3: Type check**

Run: `npx -p typescript tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/remix/app/components/general/document-signing/document-signing-radio-field.tsx
git commit -m "feat: offset-aware rendering for radio fields in signing view"
```

---

### Task 5: Offset-Aware Rendering in Read-Only / Editor Preview (field-content.tsx)

**Files:**
- Modify: `packages/ui/primitives/document-flow/field-content.tsx`

- [ ] **Step 1: Update checkbox rendering in FieldContent**

In `field-content.tsx`, the checkbox rendering section (around line 43-101) uses flex layout with direction. Apply the same offset pattern. After the `checkedValues` declaration, add:

```typescript
const useCustomPositioning = field.fieldMeta.direction === 'custom' &&
  field.fieldMeta.values?.every(
    (item: { offsetX?: number; offsetY?: number }) =>
      item.offsetX !== undefined && item.offsetY !== undefined,
  );
```

Then update both the placeholder and populated checkbox divs to use the same conditional className and style pattern from Task 3. Replace the outer `div` className:

```typescript
className={cn(
  'gap-1 py-0.5',
  useCustomPositioning
    ? 'relative'
    : cn(
        'flex',
        field.fieldMeta.direction === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col gap-y-1',
      ),
)}
```

And add the item-level style:

```typescript
style={
  useCustomPositioning && item.offsetX !== undefined && item.offsetY !== undefined
    ? { position: 'absolute' as const, left: `${item.offsetX}%`, top: `${item.offsetY}%` }
    : undefined
}
```

- [ ] **Step 2: Update radio rendering in FieldContent**

Apply the same pattern to the radio rendering section (around line 104-135). Add `useCustomPositioning` check and conditional positioning styles.

- [ ] **Step 3: Type check**

Run: `npx -p typescript tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/ui/primitives/document-flow/field-content.tsx
git commit -m "feat: offset-aware rendering in read-only field content"
```

---

### Task 6: Editor Form Updates (Checkbox)

**Files:**
- Modify: `apps/remix/app/components/forms/editor/editor-field-checkbox-form.tsx`

- [ ] **Step 1: Add 'custom' to the direction Select and handle offset inputs**

In `editor-field-checkbox-form.tsx`:

First, update the form schema to include offset fields in the values. The existing `ZCheckboxFieldFormSchema` picks from `ZCheckboxFieldMeta`, so the offsetX/offsetY fields are automatically included via `.pick({ values: true })`. No schema change needed.

Add a `SelectItem` for 'custom' to the direction `Select` (around line 193-201). Make it disabled so users can't select it directly:

```typescript
<SelectContent position="popper">
  <SelectItem value="vertical">
    <Trans>Vertical</Trans>
  </SelectItem>
  <SelectItem value="horizontal">
    <Trans>Horizontal</Trans>
  </SelectItem>
  <SelectItem value="custom" disabled>
    <Trans>Custom</Trans>
  </SelectItem>
</SelectContent>
```

- [ ] **Step 2: Add offset inputs to each value item**

In the values list (around line 313-357), after the existing `Input` for the value text and before the `Trash` button, add X and Y offset inputs:

```typescript
<li key={`checkbox-value-${index}`} className="flex flex-row items-center gap-2">
  <FormField
    control={form.control}
    name={`values.${index}.checked`}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          <Checkbox
            data-testid={`field-form-values-${index}-checked`}
            className="h-5 w-5 border-foreground/30 data-[state=checked]:bg-primary"
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        </FormControl>
      </FormItem>
    )}
  />

  <FormField
    control={form.control}
    name={`values.${index}.value`}
    render={({ field }) => (
      <FormItem className="flex-1">
        <FormControl>
          <Input
            data-testid={`field-form-values-${index}-value`}
            className="w-full"
            {...field}
          />
        </FormControl>
      </FormItem>
    )}
  />

  <FormField
    control={form.control}
    name={`values.${index}.offsetX`}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          <Input
            type="number"
            data-testid={`field-form-values-${index}-offsetX`}
            className="w-16"
            placeholder="X"
            {...field}
            value={field.value ?? ''}
            onChange={(e) => {
              const val = e.target.value === '' ? undefined : Number(e.target.value);
              field.onChange(val);
              if (val !== undefined) {
                form.setValue('direction', 'custom');
              }
            }}
          />
        </FormControl>
      </FormItem>
    )}
  />

  <FormField
    control={form.control}
    name={`values.${index}.offsetY`}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          <Input
            type="number"
            data-testid={`field-form-values-${index}-offsetY`}
            className="w-16"
            placeholder="Y"
            {...field}
            value={field.value ?? ''}
            onChange={(e) => {
              const val = e.target.value === '' ? undefined : Number(e.target.value);
              field.onChange(val);
              if (val !== undefined) {
                form.setValue('direction', 'custom');
              }
            }}
          />
        </FormControl>
      </FormItem>
    )}
  />

  <button
    type="button"
    data-testid={`field-form-values-${index}-remove`}
    className="flex h-10 w-10 items-center justify-center text-slate-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
    onClick={() => removeValue(index)}
  >
    <Trash className="h-5 w-5" />
  </button>
</li>
```

- [ ] **Step 3: Clear offsets when direction changes to vertical/horizontal**

In the direction `Select`'s `onValueChange` handler, add logic to clear offsets when switching away from 'custom'. Update the direction `FormField` render (around line 180):

```typescript
<Select
  value={field.value}
  onValueChange={(val) => {
    field.onChange(val);
    if (val !== 'custom') {
      const currentValues = form.getValues('values') || [];
      const clearedValues = currentValues.map((v) => ({
        ...v,
        offsetX: undefined,
        offsetY: undefined,
      }));
      form.setValue('values', clearedValues);
    }
  }}
>
```

- [ ] **Step 4: Type check**

Run: `npx -p typescript tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/remix/app/components/forms/editor/editor-field-checkbox-form.tsx
git commit -m "feat: add offset inputs and custom direction to checkbox editor form"
```

---

### Task 7: Editor Form Updates (Radio)

**Files:**
- Modify: `apps/remix/app/components/forms/editor/editor-field-radio-form.tsx`

- [ ] **Step 1: Apply the same changes as Task 6 to the radio editor form**

The radio form mirrors the checkbox form. Apply the identical changes:

1. Add `<SelectItem value="custom" disabled>` to the direction Select (around line 149-156)
2. Add offsetX/offsetY `Input` fields to each value item in the values list (around line 184-241)
3. Add offset-clearing logic to the direction `onValueChange` handler

The code is identical to Task 6 except:
- Form field names use the radio schema (`ZRadioFieldFormSchema`)
- Test IDs use the same pattern (they already match)
- No validation rule/length fields (radio doesn't have those)

For the direction Select (around line 142):

```typescript
<Select
  value={field.value}
  onValueChange={(val) => {
    field.onChange(val);
    if (val !== 'custom') {
      const currentValues = form.getValues('values') || [];
      const clearedValues = currentValues.map((v) => ({
        ...v,
        offsetX: undefined,
        offsetY: undefined,
      }));
      form.setValue('values', clearedValues);
    }
  }}
>
  <SelectTrigger
    data-testid="field-form-direction"
    className="w-full bg-background text-muted-foreground"
  >
    <SelectValue placeholder={t`Select direction`} />
  </SelectTrigger>
  <SelectContent position="popper">
    <SelectItem value="vertical">
      <Trans>Vertical</Trans>
    </SelectItem>
    <SelectItem value="horizontal">
      <Trans>Horizontal</Trans>
    </SelectItem>
    <SelectItem value="custom" disabled>
      <Trans>Custom</Trans>
    </SelectItem>
  </SelectContent>
</Select>
```

For each value item, add the same offsetX/offsetY inputs as Task 6 Step 2 (between the value `Input` and the `Trash` button).

- [ ] **Step 2: Type check**

Run: `npx -p typescript tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/remix/app/components/forms/editor/editor-field-radio-form.tsx
git commit -m "feat: add offset inputs and custom direction to radio editor form"
```

---

### Task 8: Integration Testing and Verification

**Files:**
- No new files. Manual verification against dev environment.

- [ ] **Step 1: Run the full unit test suite**

Run: `cd packages/lib && bunx vitest run --project unit`
Expected: All tests pass

- [ ] **Step 2: Run type checking across the monorepo**

Run: `npx -p typescript tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Deploy to dev and verify**

Build, push to GHCR, and deploy to `documenso-dev.psd401.net`. Test:

1. **Transparency**: Open an existing template with checkbox/radio fields. The field borders should be thin and semi-transparent on the signing page. Other field types (signature, text, etc.) should look unchanged.

2. **Offset positioning**: Create a new template. Add a checkbox group. In the editor sidebar, enter X/Y offsets for individual items. Verify the direction switches to "Custom". Send the document and verify the signing view renders checkboxes at the offset positions.

3. **Backward compatibility**: Open an existing document with checkbox/radio fields (no offsets). Verify they render identically to before (flex layout).

4. **Editor round-trip**: Open a field with custom offsets in the editor. Verify the direction shows "Custom" and offsets are preserved. Change direction back to "Vertical" and verify offsets are cleared.

- [ ] **Step 4: Commit any fixes discovered during testing**
