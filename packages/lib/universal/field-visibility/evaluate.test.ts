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

  it('chained: when A fails, B hides, and C evaluates against hidden B (still sees B\'s committed value)', () => {
    const a = mkField({
      id: 1, type: FieldType.RADIO, customText: 'No', inserted: true,
      fieldMeta: { type: 'radio', stableId: 'A' },
    });
    // B has customText filled from a prior state when A was 'Yes'; A is now 'No' so B is hidden.
    const b = mkField({
      id: 2, type: FieldType.TEXT, customText: 'Jane', inserted: true,
      fieldMeta: vis(
        { match: 'all', rules: [{ operator: 'equals', triggerFieldStableId: 'A', value: 'Yes' }] },
        'B',
      ),
    });
    // C depends on B being non-empty. B's customText is still 'Jane' even though B is hidden,
    // so C's condition is met and C is visible. This documents the "committed values are
    // the source of truth" semantic — cleanup of stale values happens at completion, not during
    // live evaluation.
    const c = mkField({
      id: 3, type: FieldType.TEXT,
      fieldMeta: vis({ match: 'all', rules: [{ operator: 'isNotEmpty', triggerFieldStableId: 'B' }] }, 'C'),
    });
    const m = evaluateAllVisibility([a, b, c]);
    expect(m.get(2)).toBe(false); // B hidden because A failed
    expect(m.get(3)).toBe(true); // C visible because B's stale customText is still non-empty
  });
});
