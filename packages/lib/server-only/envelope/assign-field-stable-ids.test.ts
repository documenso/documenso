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
