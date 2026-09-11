import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  ZEnvelopeFieldAndMetaSchema,
  ZFieldMetaNotOptionalSchema,
  ZFieldMetaSchema,
  ZTextFieldMeta,
} from './field-meta';

describe('ZFieldMetaSchema - required and readOnly mutual exclusivity', () => {
  it('rejects fieldMeta when both required and readOnly are true via ZFieldMetaNotOptionalSchema for text', () => {
    const result = ZFieldMetaNotOptionalSchema.safeParse({
      type: 'text',
      required: true,
      readOnly: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects fieldMeta when both required and readOnly are true via ZFieldMetaNotOptionalSchema for number', () => {
    const result = ZFieldMetaNotOptionalSchema.safeParse({
      type: 'number',
      required: true,
      readOnly: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects fieldMeta when both required and readOnly are true via ZFieldMetaNotOptionalSchema for checkbox', () => {
    const result = ZFieldMetaNotOptionalSchema.safeParse({
      type: 'checkbox',
      required: true,
      readOnly: true,
      values: [{ id: 1, checked: false, value: 'opt1' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects fieldMeta when both required and readOnly are true via ZFieldMetaNotOptionalSchema for radio', () => {
    const result = ZFieldMetaNotOptionalSchema.safeParse({
      type: 'radio',
      required: true,
      readOnly: true,
      values: [{ id: 1, checked: false, value: 'opt1' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects fieldMeta when both required and readOnly are true via ZFieldMetaNotOptionalSchema for dropdown', () => {
    const result = ZFieldMetaNotOptionalSchema.safeParse({
      type: 'dropdown',
      required: true,
      readOnly: true,
      values: [{ value: 'opt1' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects fieldMeta when both required and readOnly are true via ZFieldMetaSchema', () => {
    const result = ZFieldMetaSchema.safeParse({
      type: 'text',
      required: true,
      readOnly: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects fieldMeta when both required and readOnly are true via ZEnvelopeFieldAndMetaSchema', () => {
    const result = ZEnvelopeFieldAndMetaSchema.safeParse({
      type: FieldType.TEXT,
      fieldMeta: {
        type: 'text',
        required: true,
        readOnly: true,
      },
    });
    expect(result.success).toBe(false);
  });

  it('accepts fieldMeta when only required is true', () => {
    const result = ZTextFieldMeta.safeParse({
      type: 'text',
      required: true,
      readOnly: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts fieldMeta when only readOnly is true', () => {
    const result = ZTextFieldMeta.safeParse({
      type: 'text',
      required: false,
      readOnly: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts fieldMeta when both required and readOnly are omitted or false', () => {
    const result = ZTextFieldMeta.safeParse({
      type: 'text',
    });
    expect(result.success).toBe(true);
  });
});
