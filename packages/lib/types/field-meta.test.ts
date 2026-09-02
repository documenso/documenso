import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  FIELD_TEXT_META_DEFAULT_VALUES,
  ZEnvelopeFieldAndMetaSchema,
  ZEnvelopeFieldAndMetaUpdateSchema,
} from './field-meta';

describe('ZEnvelopeFieldAndMetaSchema', () => {
  it('applies create-time meta defaults when fieldMeta is omitted', () => {
    const result = ZEnvelopeFieldAndMetaSchema.parse({ type: FieldType.TEXT });

    expect(result).toEqual({
      type: FieldType.TEXT,
      fieldMeta: FIELD_TEXT_META_DEFAULT_VALUES,
    });
  });
});

describe('ZEnvelopeFieldAndMetaUpdateSchema', () => {
  it('keeps an omitted fieldMeta undefined so updates do not reset stored meta', () => {
    const result = ZEnvelopeFieldAndMetaUpdateSchema.parse({ type: FieldType.TEXT });

    expect(result).toEqual({
      type: FieldType.TEXT,
      fieldMeta: undefined,
    });
  });

  it('still validates a provided fieldMeta', () => {
    const meta = { type: 'text', label: 'Work email', required: true };

    const result = ZEnvelopeFieldAndMetaUpdateSchema.parse({
      type: FieldType.TEXT,
      fieldMeta: meta,
    });

    expect(result.fieldMeta).toEqual(meta);
  });

  it('keeps every member optional without defaults', () => {
    const members = [
      FieldType.SIGNATURE,
      FieldType.INITIALS,
      FieldType.NAME,
      FieldType.EMAIL,
      FieldType.DATE,
      FieldType.TEXT,
      FieldType.NUMBER,
      FieldType.RADIO,
      FieldType.CHECKBOX,
      FieldType.DROPDOWN,
    ];

    for (const type of members) {
      const result = ZEnvelopeFieldAndMetaUpdateSchema.parse({ type });

      expect(result).toEqual({ type, fieldMeta: undefined });
    }
  });
});
