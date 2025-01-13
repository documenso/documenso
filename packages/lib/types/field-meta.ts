import { z } from 'zod';

export const ZBaseFieldMeta = z.object({
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
});

export type TBaseFieldMeta = z.infer<typeof ZBaseFieldMeta>;

export const ZInitialsFieldMeta = z.object({
  type: z.literal('initials').default('initials'),
  fontSize: z.number().min(8).max(96).optional(),
});

export type TInitialsFieldMeta = z.infer<typeof ZInitialsFieldMeta>;

export const ZNameFieldMeta = z.object({
  type: z.literal('name').default('name'),
  fontSize: z.number().min(8).max(96).optional(),
});

export type TNameFieldMeta = z.infer<typeof ZNameFieldMeta>;

export const ZEmailFieldMeta = z.object({
  type: z.literal('email').default('email'),
  fontSize: z.number().min(8).max(96).optional(),
});

export type TEmailFieldMeta = z.infer<typeof ZEmailFieldMeta>;

export const ZDateFieldMeta = z.object({
  type: z.literal('date').default('date'),
  fontSize: z.number().min(8).max(96).optional(),
});

export type TDateFieldMeta = z.infer<typeof ZDateFieldMeta>;

export const ZTextFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('text').default('text'),
  text: z.string().optional(),
  characterLimit: z.number().optional(),
  fontSize: z.number().min(8).max(96).optional(),
});

export type TTextFieldMeta = z.infer<typeof ZTextFieldMeta>;

export const ZNumberFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('number').default('number'),
  numberFormat: z.string().optional(),
  value: z.string().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  fontSize: z.number().min(8).max(96).optional(),
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

/**
 * This will parse empty objects to { "type": "initials" }
 *
 * Todo: Fix.
 */
export const ZFieldMetaSchema = z
  .union([
    ZBaseFieldMeta.extend(ZInitialsFieldMeta.shape),
    ZBaseFieldMeta.extend(ZNameFieldMeta.shape),
    ZBaseFieldMeta.extend(ZEmailFieldMeta.shape),
    ZBaseFieldMeta.extend(ZDateFieldMeta.shape),
    ZTextFieldMeta,
    ZNumberFieldMeta,
    ZRadioFieldMeta,
    ZCheckboxFieldMeta,
    ZDropdownFieldMeta,
  ])
  .optional();

export type TFieldMetaSchema = z.infer<typeof ZFieldMetaSchema>;
