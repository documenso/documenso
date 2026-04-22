import { describe, expect, it } from 'vitest';

import {
  ZCheckboxFieldMeta,
  ZDateFieldMeta,
  ZDropdownFieldMeta,
  ZEmailFieldMeta,
  ZInitialsFieldMeta,
  ZNameFieldMeta,
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

  it.each([
    ['signature', ZSignatureFieldMeta],
    ['date', ZDateFieldMeta],
    ['initials', ZInitialsFieldMeta],
    ['name', ZNameFieldMeta],
    ['email', ZEmailFieldMeta],
  ])('rejects visibility on %s fields', (type, schema) => {
    expect(() => schema.parse({ type, visibility: validBlock })).toThrow();
  });

  it('requires value when operator is equals', () => {
    expect(() =>
      ZVisibilityBlock.parse({
        match: 'all',
        rules: [{ operator: 'equals', triggerFieldStableId: 'abc' }],
      }),
    ).toThrow();
  });

  it.each([['isEmpty'], ['isNotEmpty']])(
    'rejects value when operator is %s',
    (operator) => {
      expect(() =>
        ZVisibilityBlock.parse({
          match: 'all',
          rules: [{ operator, triggerFieldStableId: 'abc', value: 'x' }],
        }),
      ).toThrow();
    },
  );

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

  it('accepts match any', () => {
    expect(() =>
      ZVisibilityBlock.parse({
        match: 'any',
        rules: [{ operator: 'equals', triggerFieldStableId: 'abc', value: 'x' }],
      }),
    ).not.toThrow();
  });

  it('rejects empty triggerFieldStableId', () => {
    expect(() =>
      ZVisibilityBlock.parse({
        match: 'all',
        rules: [{ operator: 'equals', triggerFieldStableId: '', value: 'x' }],
      }),
    ).toThrow();
  });
});
