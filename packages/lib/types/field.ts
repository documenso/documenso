import { FieldType, Prisma } from '@prisma/client';
import { z } from 'zod';

import { FieldSchema } from '@documenso/prisma/generated/zod/modelSchema/FieldSchema';

import {
  FIELD_SIGNATURE_META_DEFAULT_VALUES,
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
} from './field-meta';

/**
 * The full field response schema.
 *
 * If you need to return something different, adjust this file to utilise the:
 * - ZFieldSchema
 * - ZFieldLiteSchema
 * - ZFieldManySchema
 *
 * Setup similar to:
 * - ./documents.ts
 * - ./templates.ts
 */
export const ZFieldSchema = FieldSchema.pick({
  envelopeId: true,
  envelopeItemId: true,
  type: true,
  id: true,
  secondaryId: true,
  recipientId: true,
  page: true,
  positionX: true,
  positionY: true,
  width: true,
  height: true,
  customText: true,
  inserted: true,
  fieldMeta: true,
}).extend({
  // Backwards compatibility.
  documentId: z.number().nullish(),
  templateId: z.number().nullish(),
});

export const ZEnvelopeFieldSchema = ZFieldSchema.omit({
  documentId: true,
  templateId: true,
});

export const ZFieldPageNumberSchema = z
  .number()
  .min(1)
  .describe('The page number the field will be on.');

export const ZFieldPageXSchema = z
  .number()
  .min(0)
  .describe('The X coordinate of where the field will be placed.');

export const ZFieldPageYSchema = z
  .number()
  .min(0)
  .describe('The Y coordinate of where the field will be placed.');

export const ZFieldWidthSchema = z.number().min(1).describe('The width of the field.');

export const ZFieldHeightSchema = z.number().min(1).describe('The height of the field.');

export const ZClampedFieldPositionXSchema = z
  .number()
  .min(0)
  .max(100)
  .describe('The percentage based X coordinate where the field will be placed.');

export const ZClampedFieldPositionYSchema = z
  .number()
  .min(0)
  .max(100)
  .describe('The percentage based Y coordinate where the field will be placed.');

export const ZClampedFieldWidthSchema = z
  .number()
  .min(0)
  .max(100)
  .describe('The percentage based width of the field on the page.');

export const ZClampedFieldHeightSchema = z
  .number()
  .min(0)
  .max(100)
  .describe('The percentage based height of the field on the page.');

// ---------------------------------------------

const PrismaDecimalSchema = z.preprocess(
  (val) => (typeof val === 'string' ? new Prisma.Decimal(val) : val),
  z.instanceof(Prisma.Decimal, { message: 'Must be a Decimal' }),
);

export const BaseFieldSchemaUsingNumbers = ZFieldSchema.extend({
  positionX: PrismaDecimalSchema,
  positionY: PrismaDecimalSchema,
  width: PrismaDecimalSchema,
  height: PrismaDecimalSchema,
});

export const ZFieldTextSchema = BaseFieldSchemaUsingNumbers.extend({
  type: z.literal(FieldType.TEXT),
  fieldMeta: ZTextFieldMeta,
});

export type TFieldText = z.infer<typeof ZFieldTextSchema>;

export const ZFieldSignatureSchema = BaseFieldSchemaUsingNumbers.extend({
  type: z.literal(FieldType.SIGNATURE),
  fieldMeta: ZSignatureFieldMeta.catch(FIELD_SIGNATURE_META_DEFAULT_VALUES),
});

export type TFieldSignature = z.infer<typeof ZFieldSignatureSchema>;

export const ZFieldFreeSignatureSchema = ZFieldSignatureSchema;

export type TFieldFreeSignature = z.infer<typeof ZFieldFreeSignatureSchema>;

export const ZFieldInitialsSchema = BaseFieldSchemaUsingNumbers.extend({
  type: z.literal(FieldType.INITIALS),
  fieldMeta: ZInitialsFieldMeta,
});

export type TFieldInitials = z.infer<typeof ZFieldInitialsSchema>;

export const ZFieldNameSchema = BaseFieldSchemaUsingNumbers.extend({
  type: z.literal(FieldType.NAME),
  fieldMeta: ZNameFieldMeta,
});

export type TFieldName = z.infer<typeof ZFieldNameSchema>;

export const ZFieldEmailSchema = BaseFieldSchemaUsingNumbers.extend({
  type: z.literal(FieldType.EMAIL),
  fieldMeta: ZEmailFieldMeta,
});

export type TFieldEmail = z.infer<typeof ZFieldEmailSchema>;

export const ZFieldDateSchema = BaseFieldSchemaUsingNumbers.extend({
  type: z.literal(FieldType.DATE),
  fieldMeta: ZDateFieldMeta,
});

export type TFieldDate = z.infer<typeof ZFieldDateSchema>;

export const ZFieldNumberSchema = BaseFieldSchemaUsingNumbers.extend({
  type: z.literal(FieldType.NUMBER),
  fieldMeta: ZNumberFieldMeta,
});

export type TFieldNumber = z.infer<typeof ZFieldNumberSchema>;

export const ZFieldRadioSchema = BaseFieldSchemaUsingNumbers.extend({
  type: z.literal(FieldType.RADIO),
  fieldMeta: ZRadioFieldMeta,
});

export type TFieldRadio = z.infer<typeof ZFieldRadioSchema>;

export const ZFieldCheckboxSchema = BaseFieldSchemaUsingNumbers.extend({
  type: z.literal(FieldType.CHECKBOX),
  fieldMeta: ZCheckboxFieldMeta,
});

export type TFieldCheckbox = z.infer<typeof ZFieldCheckboxSchema>;

export const ZFieldDropdownSchema = BaseFieldSchemaUsingNumbers.extend({
  type: z.literal(FieldType.DROPDOWN),
  fieldMeta: ZDropdownFieldMeta,
});

export type TFieldDropdown = z.infer<typeof ZFieldDropdownSchema>;

/**
 * The full field schema which will enforce all types and meta fields.
 */
export const ZFullFieldSchema = z.discriminatedUnion('type', [
  ZFieldTextSchema,
  ZFieldSignatureSchema,
  ZFieldInitialsSchema,
  ZFieldNameSchema,
  ZFieldEmailSchema,
  ZFieldDateSchema,
  ZFieldNumberSchema,
  ZFieldRadioSchema,
  ZFieldCheckboxSchema,
  ZFieldDropdownSchema,
]);

export type TFullFieldSchema = z.infer<typeof ZFullFieldSchema>;
