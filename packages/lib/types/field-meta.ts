import { msg } from '@lingui/core/macro';
import { FieldType } from '@prisma/client';
import { z } from 'zod';

import { DEFAULT_SIGNATURE_TEXT_FONT_SIZE } from '../constants/pdf';

export const FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN = 'middle';
export const FIELD_DEFAULT_GENERIC_ALIGN = 'left';
export const FIELD_DEFAULT_LINE_HEIGHT = 1;
export const FIELD_DEFAULT_LETTER_SPACING = 0;

export const FIELD_MIN_LINE_HEIGHT = 1;
export const FIELD_MAX_LINE_HEIGHT = 10;

export const FIELD_MIN_LETTER_SPACING = 0;
export const FIELD_MAX_LETTER_SPACING = 100;

export const DEFAULT_FIELD_FONT_SIZE = 12;

/**
 * Grouped field types that use the same generic text rendering function.
 */
export type GenericTextFieldTypeMetas =
  | TInitialsFieldMeta
  | TNameFieldMeta
  | TEmailFieldMeta
  | TDateFieldMeta
  | TTextFieldMeta
  | TNumberFieldMeta;

const ZFieldMetaLineHeight = z.coerce
  .number()
  .min(FIELD_MIN_LINE_HEIGHT)
  .max(FIELD_MAX_LINE_HEIGHT)
  .describe('The line height of the text');
const ZFieldMetaLetterSpacing = z.coerce
  .number()
  .min(FIELD_MIN_LETTER_SPACING)
  .max(FIELD_MAX_LETTER_SPACING)
  .describe('The spacing between each character');
const ZFieldMetaVerticalAlign = z
  .enum(['top', 'middle', 'bottom'])
  .describe('The vertical alignment of the text');

export const ZBaseFieldMeta = z.object({
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  fontSize: z.number().min(8).max(96).default(DEFAULT_FIELD_FONT_SIZE).optional(),
});

export type TBaseFieldMeta = z.infer<typeof ZBaseFieldMeta>;

export const ZFieldTextAlignSchema = z.enum(['left', 'center', 'right']);

export type TFieldTextAlignSchema = z.infer<typeof ZFieldTextAlignSchema>;

export const ZInitialsFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('initials'),
  textAlign: ZFieldTextAlignSchema.optional(),
});

export type TInitialsFieldMeta = z.infer<typeof ZInitialsFieldMeta>;

export const ZNameFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('name'),
  textAlign: ZFieldTextAlignSchema.optional(),
});

export type TNameFieldMeta = z.infer<typeof ZNameFieldMeta>;

export const ZEmailFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('email'),
  textAlign: ZFieldTextAlignSchema.optional(),
});

export type TEmailFieldMeta = z.infer<typeof ZEmailFieldMeta>;

export const ZDateFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('date'),
  textAlign: ZFieldTextAlignSchema.optional(),
});

export type TDateFieldMeta = z.infer<typeof ZDateFieldMeta>;

export const ZTextFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('text'),
  text: z.string().optional(),
  characterLimit: z.coerce
    .number({ invalid_type_error: msg`Value must be a number`.id })
    .min(0)
    .optional(),
  textAlign: ZFieldTextAlignSchema.optional(),
  lineHeight: ZFieldMetaLineHeight.nullish(),
  letterSpacing: ZFieldMetaLetterSpacing.nullish(),
  verticalAlign: ZFieldMetaVerticalAlign.nullish(),
});

export type TTextFieldMeta = z.infer<typeof ZTextFieldMeta>;

export const ZNumberFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('number'),
  numberFormat: z.string().nullish(),
  value: z.string().optional(),
  minValue: z.coerce.number().nullish(),
  maxValue: z.coerce.number().nullish(),
  textAlign: ZFieldTextAlignSchema.optional(),
  lineHeight: ZFieldMetaLineHeight.nullish(),
  letterSpacing: ZFieldMetaLetterSpacing.nullish(),
  verticalAlign: ZFieldMetaVerticalAlign.nullish(),
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
  direction: z.enum(['vertical', 'horizontal']).optional().default('vertical'),
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
  direction: z.enum(['vertical', 'horizontal']).optional().default('vertical'),
});

export type TCheckboxFieldMeta = z.infer<typeof ZCheckboxFieldMeta>;

export const ZDropdownFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('dropdown'),
  values: z.array(z.object({ value: z.string() })).optional(),
  defaultValue: z.string().optional(),
});

export type TDropdownFieldMeta = z.infer<typeof ZDropdownFieldMeta>;

export const ZSignatureFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('signature'),
});

export type TSignatureFieldMeta = z.infer<typeof ZSignatureFieldMeta>;

export const ZFieldMetaNotOptionalSchema = z.discriminatedUnion('type', [
  ZSignatureFieldMeta,
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
    fieldMeta: ZSignatureFieldMeta.optional(),
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

export const FIELD_DATE_META_DEFAULT_VALUES: TDateFieldMeta = {
  type: 'date',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  textAlign: 'left',
};

export const FIELD_TEXT_META_DEFAULT_VALUES: TTextFieldMeta = {
  type: 'text',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  textAlign: 'left',
  label: '',
  placeholder: '',
  text: '',
  required: false,
  readOnly: false,
};

export const FIELD_NUMBER_META_DEFAULT_VALUES: TNumberFieldMeta = {
  type: 'number',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  textAlign: 'left',
  label: '',
  placeholder: '',
  required: false,
  readOnly: false,
};

export const FIELD_INITIALS_META_DEFAULT_VALUES: TInitialsFieldMeta = {
  type: 'initials',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  textAlign: 'left',
};

export const FIELD_NAME_META_DEFAULT_VALUES: TNameFieldMeta = {
  type: 'name',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  textAlign: 'left',
};

export const FIELD_EMAIL_META_DEFAULT_VALUES: TEmailFieldMeta = {
  type: 'email',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  textAlign: 'left',
};

export const FIELD_RADIO_META_DEFAULT_VALUES: TRadioFieldMeta = {
  type: 'radio',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  values: [{ id: 1, checked: false, value: '' }],
  required: false,
  readOnly: false,
  direction: 'vertical',
};

export const FIELD_CHECKBOX_META_DEFAULT_VALUES: TCheckboxFieldMeta = {
  type: 'checkbox',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  values: [{ id: 1, checked: false, value: '' }],
  validationRule: '',
  validationLength: 0,
  required: false,
  readOnly: false,
  direction: 'vertical',
};

export const FIELD_DROPDOWN_META_DEFAULT_VALUES: TDropdownFieldMeta = {
  type: 'dropdown',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  values: [{ value: 'Option 1' }],
  defaultValue: '',
  required: false,
  readOnly: false,
};

export const FIELD_SIGNATURE_META_DEFAULT_VALUES: TSignatureFieldMeta = {
  type: 'signature',
  fontSize: DEFAULT_SIGNATURE_TEXT_FONT_SIZE,
};

export const FIELD_META_DEFAULT_VALUES: Record<FieldType, TFieldMetaSchema> = {
  [FieldType.SIGNATURE]: FIELD_SIGNATURE_META_DEFAULT_VALUES,
  [FieldType.FREE_SIGNATURE]: undefined,
  [FieldType.INITIALS]: FIELD_INITIALS_META_DEFAULT_VALUES,
  [FieldType.NAME]: FIELD_NAME_META_DEFAULT_VALUES,
  [FieldType.EMAIL]: FIELD_EMAIL_META_DEFAULT_VALUES,
  [FieldType.DATE]: FIELD_DATE_META_DEFAULT_VALUES,
  [FieldType.TEXT]: FIELD_TEXT_META_DEFAULT_VALUES,
  [FieldType.NUMBER]: FIELD_NUMBER_META_DEFAULT_VALUES,
  [FieldType.RADIO]: FIELD_RADIO_META_DEFAULT_VALUES,
  [FieldType.CHECKBOX]: FIELD_CHECKBOX_META_DEFAULT_VALUES,
  [FieldType.DROPDOWN]: FIELD_DROPDOWN_META_DEFAULT_VALUES,
} as const;

export const ZEnvelopeFieldAndMetaSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(FieldType.SIGNATURE),
    fieldMeta: ZSignatureFieldMeta.optional().default(FIELD_SIGNATURE_META_DEFAULT_VALUES),
  }),
  z.object({
    type: z.literal(FieldType.FREE_SIGNATURE),
    fieldMeta: z.undefined(),
  }),
  z.object({
    type: z.literal(FieldType.INITIALS),
    fieldMeta: ZInitialsFieldMeta.optional().default(FIELD_INITIALS_META_DEFAULT_VALUES),
  }),
  z.object({
    type: z.literal(FieldType.NAME),
    fieldMeta: ZNameFieldMeta.optional().default(FIELD_NAME_META_DEFAULT_VALUES),
  }),
  z.object({
    type: z.literal(FieldType.EMAIL),
    fieldMeta: ZEmailFieldMeta.optional().default(FIELD_EMAIL_META_DEFAULT_VALUES),
  }),
  z.object({
    type: z.literal(FieldType.DATE),
    fieldMeta: ZDateFieldMeta.optional().default(FIELD_DATE_META_DEFAULT_VALUES),
  }),
  z.object({
    type: z.literal(FieldType.TEXT),
    fieldMeta: ZTextFieldMeta.optional().default(FIELD_TEXT_META_DEFAULT_VALUES),
  }),
  z.object({
    type: z.literal(FieldType.NUMBER),
    fieldMeta: ZNumberFieldMeta.optional().default(FIELD_NUMBER_META_DEFAULT_VALUES),
  }),
  z.object({
    type: z.literal(FieldType.RADIO),
    fieldMeta: ZRadioFieldMeta.optional().default(FIELD_RADIO_META_DEFAULT_VALUES),
  }),
  z.object({
    type: z.literal(FieldType.CHECKBOX),
    fieldMeta: ZCheckboxFieldMeta.optional().default(FIELD_CHECKBOX_META_DEFAULT_VALUES),
  }),
  z.object({
    type: z.literal(FieldType.DROPDOWN),
    fieldMeta: ZDropdownFieldMeta.optional().default(FIELD_DROPDOWN_META_DEFAULT_VALUES),
  }),
]);

type TEnvelopeFieldAndMeta = z.infer<typeof ZEnvelopeFieldAndMetaSchema>;
