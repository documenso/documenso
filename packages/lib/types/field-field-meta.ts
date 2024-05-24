import { z } from 'zod';

export const ZBaseFieldMeta = z.object({
  label: z.literal('base').optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
});

export const ZTextFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('text').default('text'),
  text: z.string().optional(),
  characterLimit: z.number().optional(),
});

export const ZNumberFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('number').default('number'),
  numberFormat: z.string().optional(),
  value: z.number().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
});

export const ZRadioFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('radio').default('radio'),
  values: z
    .array(
      z.object({
        checked: z.boolean(),
        value: z.string(),
      }),
    )
    .optional(),
});

export const ZCheckboxFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('checkbox').default('checkbox'),
  values: z
    .array(
      z.object({
        checked: z.boolean(),
        value: z.string(),
      }),
    )
    .optional(),
  validationRule: z.string().optional(),
  validationLength: z.number().optional(),
});

export const ZDropdownFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('dropdown').default('dropdown'),
  values: z.array(z.string()).optional(),
  defaultValue: z.string().optional(),
});

export const ZFieldMetaSchema = z.discriminatedUnion('type', [
  ZTextFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
]);
