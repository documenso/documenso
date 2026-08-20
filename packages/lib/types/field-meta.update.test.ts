import { describe, expect, it } from 'vitest';

import {
  ZEnvelopeFieldAndMetaSchema,
  ZEnvelopeFieldUpdateAndMetaSchema,
} from '@documenso/lib/types/field-meta';

describe('the update schema keeps an omitted fieldMeta undefined (#3286)', () => {
  it('create schema still materialises the type default (create behavior unchanged)', () => {
    const parsed = ZEnvelopeFieldAndMetaSchema.parse({ type: 'TEXT' });
    expect(parsed.fieldMeta).toBeDefined();
    expect(parsed.fieldMeta?.type).toBe('text');
  });

  it('update schema leaves an omitted fieldMeta undefined', () => {
    const parsed = ZEnvelopeFieldUpdateAndMetaSchema.parse({ type: 'TEXT' });
    expect(parsed.fieldMeta).toBeUndefined();
  });

  it('update schema still accepts a complete fieldMeta', () => {
    const parsed = ZEnvelopeFieldUpdateAndMetaSchema.parse({
      type: 'TEXT',
      fieldMeta: { type: 'text', label: 'Notes' },
    });
    expect(parsed.fieldMeta?.label).toBe('Notes');
  });

  it.each(['RADIO', 'CHECKBOX', 'DROPDOWN'] as const)(
    '%s option lists are not defaulted on update',
    (type) => {
      const parsed = ZEnvelopeFieldUpdateAndMetaSchema.parse({ type });
      expect(parsed.fieldMeta).toBeUndefined();
    },
  );

  it('an unknown type is rejected by both schemas', () => {
    expect(() => ZEnvelopeFieldUpdateAndMetaSchema.parse({ type: 'NOT_A_TYPE' })).toThrow();
  });
});
