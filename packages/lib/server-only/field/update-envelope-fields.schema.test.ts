import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { ZEnvelopeFieldAndMetaSchema, ZFieldAndMetaSchema } from '../../types/field-meta';

describe('ZFieldAndMetaSchema (update path fieldMeta contract)', () => {
  it('leaves fieldMeta undefined when omitted on a partial update', () => {
    const result = ZFieldAndMetaSchema.parse({ type: FieldType.TEXT });

    expect(result.fieldMeta).toBeUndefined();
  });

  it('leaves fieldMeta undefined for every meta-bearing field type when omitted', () => {
    const types = [
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

    for (const type of types) {
      const result = ZFieldAndMetaSchema.parse({ type });

      expect(result.fieldMeta, `fieldMeta should be undefined for ${type}`).toBeUndefined();
    }
  });

  it('keeps fieldMeta undefined for FREE_SIGNATURE', () => {
    const result = ZFieldAndMetaSchema.parse({ type: FieldType.FREE_SIGNATURE });

    expect(result.fieldMeta).toBeUndefined();
  });

  it('preserves an explicitly provided fieldMeta', () => {
    const fieldMeta = {
      type: 'text' as const,
      label: 'Job Title',
      placeholder: 'Enter your job title',
      required: true,
      characterLimit: 40,
    };

    const result = ZFieldAndMetaSchema.parse({
      type: FieldType.TEXT,
      fieldMeta,
    });

    expect(result.fieldMeta).toEqual(fieldMeta);
  });

  it('does not silently materialise default fieldMeta on the update path', () => {
    const result = ZFieldAndMetaSchema.parse({ type: FieldType.TEXT });

    expect(result.fieldMeta).not.toEqual(
      expect.objectContaining({
        label: '',
        placeholder: '',
        required: false,
      }),
    );
  });
});

describe('ZEnvelopeFieldAndMetaSchema (create path keeps defaults)', () => {
  it('still materialises the type defaults when fieldMeta is omitted', () => {
    const result = ZEnvelopeFieldAndMetaSchema.parse({ type: FieldType.TEXT });

    expect(result.fieldMeta).toEqual(
      expect.objectContaining({
        type: 'text',
        required: false,
        readOnly: false,
      }),
    );
  });
});
