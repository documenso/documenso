import { z } from 'zod';

export const ZBaseFieldMeta = z.object({
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
});

export type TBaseFieldMeta = z.infer<typeof ZBaseFieldMeta>;

export const ZTextFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('text').default('text'),
  text: z.string().optional(),
  characterLimit: z.number().optional(),
});

export type TTextFieldMeta = z.infer<typeof ZTextFieldMeta>;

export const ZNumberFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('number').default('number'),
  numberFormat: z.string().optional(),
  value: z.string().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
});

export type TNumberFieldMeta = z.infer<typeof ZNumberFieldMeta>;

export const ZRadioFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('radio').default('radio'),
  values: z
    .array(
      z.object({
        id: z.number(),
        checked: z.boolean(),
        value: z.string(),
      }),
    )
    .optional(),
});

export type TRadioFieldMeta = z.infer<typeof ZRadioFieldMeta>;

export const ZCheckboxFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('checkbox').default('checkbox'),
  values: z
    .array(
      z.object({
        id: z.number(),
        checked: z.boolean(),
        value: z.string(),
      }),
    )
    .optional(),
  validationRule: z.string().optional(),
  validationLength: z.number().optional(),
});

export type TCheckboxFieldMeta = z.infer<typeof ZCheckboxFieldMeta>;

export const ZDropdownFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('dropdown').default('dropdown'),
  values: z.array(z.object({ value: z.string() })).optional(),
  defaultValue: z.string().optional(),
});

export type TDropdownFieldMeta = z.infer<typeof ZDropdownFieldMeta>;

export const ZFieldMetaSchema = z
  .union([
    ZTextFieldMeta,
    ZNumberFieldMeta,
    ZRadioFieldMeta,
    ZCheckboxFieldMeta,
    ZDropdownFieldMeta,
  ])
  .optional();

export type TFieldMetaSchema = z.infer<typeof ZFieldMetaSchema>;
