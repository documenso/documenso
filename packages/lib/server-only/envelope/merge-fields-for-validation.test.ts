import { describe, expect, it } from 'vitest';

import { mergeFieldsForValidation } from './merge-fields-for-validation';

describe('mergeFieldsForValidation', () => {
  it('incoming matches existing by id → replacement (existing row removed, incoming used)', () => {
    const existing = [
      { id: 1, type: 'TEXT', recipientId: 10, fieldMeta: { stableId: 'old-stable' } },
      { id: 2, type: 'SIGNATURE', recipientId: 11, fieldMeta: null },
    ];
    const incoming = [
      { id: 1, type: 'TEXT', recipientId: 10, fieldMeta: { stableId: 'new-stable' } },
    ];

    const result = mergeFieldsForValidation(existing, incoming);

    // The replaced row uses the incoming data
    const row1 = result.find((r) => r.id === 1);
    expect(row1).toBeDefined();
    expect(row1?.fieldMeta).toEqual({ stableId: 'new-stable' });

    // Existing id=2 that wasn't in incoming is carried through
    const row2 = result.find((r) => r.id === 2);
    expect(row2).toBeDefined();
    expect(row2?.type).toBe('SIGNATURE');

    // Total should be 2 rows
    expect(result).toHaveLength(2);
  });

  it('incoming has no id → uses negative sentinel', () => {
    const existing = [{ id: 5, type: 'SIGNATURE', recipientId: 10, fieldMeta: null }];
    const incoming = [
      { id: null, type: 'TEXT', recipientId: 10, fieldMeta: { visibility: {} } },
      { id: undefined, type: 'RADIO', recipientId: 11, fieldMeta: null },
    ];

    const result = mergeFieldsForValidation(existing, incoming);

    const newField1 = result.find((r) => r.id === -1);
    expect(newField1).toBeDefined();
    expect(newField1?.type).toBe('TEXT');

    const newField2 = result.find((r) => r.id === -2);
    expect(newField2).toBeDefined();
    expect(newField2?.type).toBe('RADIO');

    // Existing is also carried through
    const existingField = result.find((r) => r.id === 5);
    expect(existingField).toBeDefined();

    expect(result).toHaveLength(3);
  });

  it('existing not in incoming → carried through unchanged', () => {
    const existing = [
      { id: 10, type: 'SIGNATURE', recipientId: 1, fieldMeta: { stableId: 'abc' } },
      { id: 11, type: 'DATE', recipientId: 2, fieldMeta: null },
    ];
    const incoming: Array<{ id?: number | null; type: string; recipientId: number; fieldMeta: unknown }> = [];

    const result = mergeFieldsForValidation(existing, incoming);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.id === 10)).toEqual(existing[0]);
    expect(result.find((r) => r.id === 11)).toEqual(existing[1]);
  });

  it('incoming id present but not found in existing → treated as new (negative sentinel)', () => {
    const existing = [{ id: 100, type: 'TEXT', recipientId: 5, fieldMeta: null }];
    const incoming = [
      { id: 999, type: 'RADIO', recipientId: 5, fieldMeta: null }, // 999 doesn't exist
    ];

    const result = mergeFieldsForValidation(existing, incoming);

    // 999 not in existing → negative sentinel
    const newRow = result.find((r) => r.id === -1);
    expect(newRow).toBeDefined();
    expect(newRow?.type).toBe('RADIO');

    // existing id=100 carried through
    const carryThrough = result.find((r) => r.id === 100);
    expect(carryThrough).toBeDefined();

    expect(result).toHaveLength(2);
  });
});
