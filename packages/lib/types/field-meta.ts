import { FieldType } from '@prisma/client';
import { z } from 'zod';

export const ZBaseFieldMeta = z.object({
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
});

export type TBaseFieldMeta = z.infer<typeof ZBaseFieldMeta>;

export const ZFieldTextAlignSchema = z.enum(['left', 'center', 'right']);

export type TFieldTextAlignSchema = z.infer<typeof ZFieldTextAlignSchema>;

export const ZInitialsFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('initials'),
  fontSize: z.number().min(8).max(96).optional(),
  textAlign: ZFieldTextAlignSchema.optional(),
});

export type TInitialsFieldMeta = z.infer<typeof ZInitialsFieldMeta>;

export const ZNameFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('name'),
  fontSize: z.number().min(8).max(96).optional(),
  textAlign: ZFieldTextAlignSchema.optional(),
});

export type TNameFieldMeta = z.infer<typeof ZNameFieldMeta>;

export const ZEmailFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('email'),
  fontSize: z.number().min(8).max(96).optional(),
  textAlign: ZFieldTextAlignSchema.optional(),
});

export type TEmailFieldMeta = z.infer<typeof ZEmailFieldMeta>;

export const ZDateFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('date'),
  fontSize: z.number().min(8).max(96).optional(),
  textAlign: ZFieldTextAlignSchema.optional(),
});

export type TDateFieldMeta = z.infer<typeof ZDateFieldMeta>;

export const ZTextFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('text'),
  text: z.string().optional(),
  characterLimit: z.number().optional(),
  fontSize: z.number().min(8).max(96).optional(),
  textAlign: ZFieldTextAlignSchema.optional(),
});

export type TTextFieldMeta = z.infer<typeof ZTextFieldMeta>;

export const ZNumberFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('number'),
  numberFormat: z.string().optional(),
  value: z.string().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  fontSize: z.number().min(8).max(96).optional(),
  textAlign: ZFieldTextAlignSchema.optional(),
});

export type TNumberFieldMeta = z.infer<typeof ZNumberFieldMeta>;

export const ZRadioFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('radio'),
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
  type: z.literal('checkbox'),
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
  type: z.literal('dropdown'),
  values: z.array(z.object({ value: z.string() })).optional(),
  defaultValue: z.string().optional(),
});

export type TDropdownFieldMeta = z.infer<typeof ZDropdownFieldMeta>;

export const ZFieldMetaNotOptionalSchema = z.discriminatedUnion('type', [
  ZInitialsFieldMeta,
  ZNameFieldMeta,
  ZEmailFieldMeta,
  ZDateFieldMeta,
  ZTextFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
]);

export type TFieldMetaNotOptionalSchema = z.infer<typeof ZFieldMetaNotOptionalSchema>;

export const ZFieldMetaPrefillFieldsSchema = z
  .object({
    id: z.number(),
  })
  .and(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('text'),
        label: z.string().optional(),
        placeholder: z.string().optional(),
        value: z.string().optional(),
      }),
      z.object({
        type: z.literal('number'),
        label: z.string().optional(),
        placeholder: z.string().optional(),
        value: z.string().optional(),
      }),
      z.object({
        type: z.literal('radio'),
        label: z.string().optional(),
        value: z.string().optional(),
      }),
      z.object({
        type: z.literal('checkbox'),
        label: z.string().optional(),
        value: z.array(z.string()).optional(),
      }),
      z.object({
        type: z.literal('dropdown'),
        label: z.string().optional(),
        value: z.string().optional(),
      }),
      z.object({
        type: z.literal('date'),
        value: z.string().optional(),
      }),
    ]),
  );

export type TFieldMetaPrefillFieldsSchema = z.infer<typeof ZFieldMetaPrefillFieldsSchema>;

export const ZFieldMetaSchema = z
  .union([
    // Handles an empty object being provided as fieldMeta.
    z
      .object({})
      .strict()
      .transform(() => undefined),
    ZFieldMetaNotOptionalSchema,
  ])
  .optional();

export type TFieldMetaSchema = z.infer<typeof ZFieldMetaSchema>;

export const ZFieldAndMetaSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(FieldType.SIGNATURE),
    fieldMeta: z.undefined(),
  }),
  z.object({
    type: z.literal(FieldType.FREE_SIGNATURE),
    fieldMeta: z.undefined(),
  }),
  z.object({
    type: z.literal(FieldType.INITIALS),
    fieldMeta: ZInitialsFieldMeta.optional(),
  }),
  z.object({
    type: z.literal(FieldType.NAME),
    fieldMeta: ZNameFieldMeta.optional(),
  }),
  z.object({
    type: z.literal(FieldType.EMAIL),
    fieldMeta: ZEmailFieldMeta.optional(),
  }),
  z.object({
    type: z.literal(FieldType.DATE),
    fieldMeta: ZDateFieldMeta.optional(),
  }),
  z.object({
    type: z.literal(FieldType.TEXT),
    fieldMeta: ZTextFieldMeta.optional(),
  }),
  z.object({
    type: z.literal(FieldType.NUMBER),
    fieldMeta: ZNumberFieldMeta.optional(),
  }),
  z.object({
    type: z.literal(FieldType.RADIO),
    fieldMeta: ZRadioFieldMeta.optional(),
  }),
  z.object({
    type: z.literal(FieldType.CHECKBOX),
    fieldMeta: ZCheckboxFieldMeta.optional(),
  }),
  z.object({
    type: z.literal(FieldType.DROPDOWN),
    fieldMeta: ZDropdownFieldMeta.optional(),
  }),
]);

export type TFieldAndMeta = z.infer<typeof ZFieldAndMetaSchema>;
