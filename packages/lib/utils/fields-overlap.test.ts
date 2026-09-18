import { describe, expect, it } from 'vitest';

import {
  FIELD_DUPLICATE_THRESHOLD,
  findDuplicateField,
  getOverlappingFieldPairs,
  hasOverlappingFields,
} from './fields-overlap';

const field = (overrides: Partial<ReturnType<typeof base>> = {}) => ({ ...base(), ...overrides });

const base = () => ({
  id: 1,
  envelopeItemId: 'item-1',
  page: 2,
  positionX: 10,
  positionY: 20,
  width: 10,
  height: 5,
  recipientId: 7,
  type: 'SIGNATURE',
});

describe('getOverlappingFieldPairs', () => {
  it('finds a pair covering most of each other', () => {
    const pairs = getOverlappingFieldPairs([field({ id: 1 }), field({ id: 2 })]);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].overlapRatio).toBe(1);
  });

  it('ignores fields that only touch at the edges', () => {
    expect(getOverlappingFieldPairs([field({ id: 1 }), field({ id: 2, positionX: 20 })])).toHaveLength(0);
  });

  it('ignores fields on a different page or envelope item', () => {
    expect(getOverlappingFieldPairs([field({ id: 1 }), field({ id: 2, page: 3 })])).toHaveLength(0);
    expect(getOverlappingFieldPairs([field({ id: 1 }), field({ id: 2, envelopeItemId: 'item-2' })])).toHaveLength(0);
  });

  it('measures the ratio against the smaller field', () => {
    // A small field sitting inside a large one is fully covered, even though it
    // takes up little of the larger field.
    const pairs = getOverlappingFieldPairs([
      field({ id: 1, width: 40, height: 20 }),
      field({ id: 2, width: 4, height: 2 }),
    ]);

    expect(pairs[0].overlapRatio).toBe(1);
  });
});

describe('hasOverlappingFields', () => {
  it('reports whether any pair overlaps', () => {
    expect(hasOverlappingFields([field({ id: 1 }), field({ id: 2 })])).toBe(true);
    expect(hasOverlappingFields([field({ id: 1 }), field({ id: 2, positionX: 50 })])).toBe(false);
    expect(hasOverlappingFields([field()])).toBe(false);
  });
});

describe('findDuplicateField', () => {
  it('finds a field the candidate would land on top of', () => {
    const existing = field({ id: 1 });

    expect(findDuplicateField([existing], field({ id: 2 }))).toBe(existing);
  });

  it('catches the case that leaves a signer stuck', () => {
    // Both fields were written to the same position for the same recipient, so
    // only the top one could be filled in and the envelope never completed.
    const existing = field({ id: 90, type: 'DATE', positionX: 66.666667, positionY: 87.137971 });
    const candidate = field({ id: 91, type: 'DATE', positionX: 66.666667, positionY: 87.137971 });

    expect(findDuplicateField([existing], candidate)).toBe(existing);
  });

  it('leaves fields for another recipient or of another type alone', () => {
    expect(findDuplicateField([field({ id: 1, recipientId: 8 })], field({ id: 2 }))).toBeUndefined();
    expect(findDuplicateField([field({ id: 1, type: 'DATE' })], field({ id: 2 }))).toBeUndefined();
  });

  it('leaves fields the sender placed close together alone', () => {
    // Half covered is well below the duplicate threshold, so this is treated as
    // two fields rather than one written twice.
    const existing = field({ id: 1 });
    const candidate = field({ id: 2, positionX: 15 });

    expect(findDuplicateField([existing], candidate)).toBeUndefined();
    expect(FIELD_DUPLICATE_THRESHOLD).toBeGreaterThan(0.5);
  });

  it('ignores fields with no area', () => {
    expect(findDuplicateField([field({ id: 1 })], field({ id: 2, width: 0 }))).toBeUndefined();
    expect(findDuplicateField([field({ id: 1, height: 0 })], field({ id: 2 }))).toBeUndefined();
  });

  it('works on editor fields, which have no id until they are saved', () => {
    // The editor calls this while placing a field, before it has been persisted,
    // so the only identifier it carries is the client-side formId.
    const existing = { ...base(), id: undefined, formId: 'a' };
    const candidate = { ...base(), id: undefined, formId: 'b' };

    expect(findDuplicateField([existing], candidate)).toBe(existing);
  });
});
