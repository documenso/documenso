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
