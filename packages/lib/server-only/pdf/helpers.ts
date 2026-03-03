import { FieldType } from '@prisma/client';
import type { Recipient } from '@prisma/client';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

type RecipientPlaceholderInfo = {
  email: string;
  name: string;
  recipientIndex: number;
};

/*
  Short aliases for field types.
  Keys are lowercase; values are the canonical uppercase field type strings
  accepted by the match() block in parseFieldTypeFromPlaceholder.

    s   → signature       fs  → free_signature
    i   → initials        n   → name
    e   → email           d   → date
    t   → text            num → number
    r   → radio           cb  → checkbox
    dd  → dropdown
*/
const SHORT_FIELD_TYPE_MAP: Record<string, string> = {
  s: 'SIGNATURE',
  fs: 'FREE_SIGNATURE',
  i: 'INITIALS',
  n: 'NAME',
  e: 'EMAIL',
  d: 'DATE',
  t: 'TEXT',
  num: 'NUMBER',
  r: 'RADIO',
  cb: 'CHECKBOX',
  dd: 'DROPDOWN',
};

/*
  Parse field type string to FieldType enum.
  Accepts both the full canonical name (case-insensitive) and short aliases.
*/
export const parseFieldTypeFromPlaceholder = (fieldTypeString: string): FieldType => {
  const trimmed = fieldTypeString.trim();
  const expandedType = (SHORT_FIELD_TYPE_MAP[trimmed.toLowerCase()] ?? trimmed).toUpperCase();

  return match(expandedType)
    .with('SIGNATURE', () => FieldType.SIGNATURE)
    .with('FREE_SIGNATURE', () => FieldType.FREE_SIGNATURE)
    .with('INITIALS', () => FieldType.INITIALS)
    .with('NAME', () => FieldType.NAME)
    .with('EMAIL', () => FieldType.EMAIL)
    .with('DATE', () => FieldType.DATE)
    .with('TEXT', () => FieldType.TEXT)
    .with('NUMBER', () => FieldType.NUMBER)
    .with('RADIO', () => FieldType.RADIO)
    .with('CHECKBOX', () => FieldType.CHECKBOX)
    .with('DROPDOWN', () => FieldType.DROPDOWN)
    .otherwise(() => {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Invalid field type: ${fieldTypeString}`,
      });
    });
};

/*
  Short aliases for option keys (both = and : are accepted as separators).

  Common (all fields):
    r   → required          ro  → readOnly
    f   → fontSize          l   → label
    p   → placeholder       id  → fieldId

  Text / Number / Initials / Name / Email / Date:
    ta  → textAlign         va  → verticalAlign
    lh  → lineHeight        ls  → letterSpacing

  Text only:
    t   → text              cl  → characterLimit

  Number only:
    v   → value             nf  → numberFormat
    min → minValue          max → maxValue

  Radio / Checkbox:
    dir → direction

  Checkbox only:
    vr  → validationRule    vl  → validationLength

  Dropdown only:
    dv  → defaultValue
*/
const SHORT_OPTION_KEY_MAP: Record<string, string> = {
  // Common
  r: 'required',
  ro: 'readOnly',
  f: 'fontSize',
  l: 'label',
  p: 'placeholder',
  id: 'fieldId',
  // Text / Number layout
  ta: 'textAlign',
  va: 'verticalAlign',
  lh: 'lineHeight',
  ls: 'letterSpacing',
  // Text
  t: 'text',
  cl: 'characterLimit',
  // Number
  v: 'value',
  nf: 'numberFormat',
  min: 'minValue',
  max: 'maxValue',
  // Radio / Checkbox
  dir: 'direction',
  // Checkbox
  vr: 'validationRule',
  vl: 'validationLength',
  // Dropdown
  dv: 'defaultValue',
};

/*
  Short value aliases for the textAlign property.
    l → left    r → right    c → center
*/
const SHORT_TEXT_ALIGN_MAP: Record<string, string> = {
  l: 'left',
  r: 'right',
  c: 'center',
};

/*
  Short value aliases for the verticalAlign property.
    t → top    m → middle    b → bottom
*/
const SHORT_VERTICAL_ALIGN_MAP: Record<string, string> = {
  t: 'top',
  m: 'middle',
  b: 'bottom',
};

/*
  Short value aliases for the direction property (Radio / Checkbox).
    v → vertical    h → horizontal
*/
const SHORT_DIRECTION_MAP: Record<string, string> = {
  v: 'vertical',
  h: 'horizontal',
};

/*
  Properties whose values are coerced to numbers.
*/
const NUMERIC_FIELDS = new Set([
  'fontSize',
  'minValue',
  'maxValue',
  'characterLimit',
  'lineHeight',
  'letterSpacing',
  'validationLength',
]);

/*
  String fields whose values are decoded from underscore-encoded form.
  Underscores are replaced with spaces and the result is title-cased.
  e.g. "my_field_name" → "My Field Name"

  Only applies to human-readable display strings, not identifiers or
  format strings (numberFormat, defaultValue, value, fieldId, etc.).
*/
const TITLE_CASE_FIELDS = new Set(['label', 'placeholder', 'text']);

const toTitleCase = (value: string): string =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/*
  Transform raw field metadata from placeholder format to schema format.
  Accepts both full property names and short aliases (see SHORT_OPTION_KEY_MAP).
  Both = and : are accepted as key/value separators (handled upstream).

  Short boolean values:      t → true,     f → false
  Short textAlign values:    l → left,     r → right,    c → center
  Short verticalAlign values:t → top,      m → middle,   b → bottom
  Short direction values:    v → vertical, h → horizontal

  Label / placeholder / text values are decoded from underscore-encoded form:
  underscores are replaced with spaces and every word is title-cased,
  e.g. "my_label" → "My Label".

  Note: signature and free_signature fields do not support fieldMeta options.
*/
export const parseFieldMetaFromPlaceholder = (
  rawFieldMeta: Record<string, string>,
  fieldType: FieldType,
): Record<string, unknown> | undefined => {
  if (fieldType === FieldType.SIGNATURE || fieldType === FieldType.FREE_SIGNATURE) {
    return;
  }

  if (Object.keys(rawFieldMeta).length === 0) {
    return;
  }

  const fieldTypeString = String(fieldType).toLowerCase();

  const parsedFieldMeta: Record<string, boolean | number | string> = {
    type: fieldTypeString,
  };

  // Expand short keys to their full property names.
  const expandedMeta: Record<string, string> = {};

  for (const [key, value] of Object.entries(rawFieldMeta)) {
    const expandedKey = SHORT_OPTION_KEY_MAP[key] ?? key;
    expandedMeta[expandedKey] = value;
  }

  for (const [property, value] of Object.entries(expandedMeta)) {
    if (property === 'readOnly' || property === 'required') {
      // Accept "true"/"false" (long form) and "t"/"f" (short form).
      parsedFieldMeta[property] = value === 'true' || value === 't';
    } else if (property === 'textAlign') {
      // Accept "left"/"right"/"center" and "l"/"r"/"c".
      parsedFieldMeta[property] = SHORT_TEXT_ALIGN_MAP[value] ?? value;
    } else if (property === 'verticalAlign') {
      // Accept "top"/"middle"/"bottom" and "t"/"m"/"b".
      parsedFieldMeta[property] = SHORT_VERTICAL_ALIGN_MAP[value] ?? value;
    } else if (property === 'direction') {
      // Accept "vertical"/"horizontal" and "v"/"h".
      parsedFieldMeta[property] = SHORT_DIRECTION_MAP[value] ?? value;
    } else if (NUMERIC_FIELDS.has(property)) {
      const numValue = Number(value);

      if (!Number.isNaN(numValue)) {
        parsedFieldMeta[property] = numValue;
      }
    } else if (TITLE_CASE_FIELDS.has(property)) {
      // Decode underscore-encoded display strings: "my_label" → "My Label".
      parsedFieldMeta[property] = toTitleCase(value);
    } else {
      // Pass through as string: value, numberFormat, defaultValue, fieldId, etc.
      parsedFieldMeta[property] = value;
    }
  }

  return parsedFieldMeta;
};

const extractRecipientPlaceholder = (placeholder: string): RecipientPlaceholderInfo => {
  const indexMatch = placeholder.match(/^r(\d+)$/i);

  if (!indexMatch) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Invalid recipient placeholder format: ${placeholder}. Expected format: r1, r2, r3, etc.`,
    });
  }

  const recipientIndex = Number(indexMatch[1]);

  return {
    email: `recipient.${recipientIndex}@documenso.com`,
    name: `Recipient ${recipientIndex}`,
    recipientIndex,
  };
};

/*
  Finds a recipient based on a placeholder reference.
  If recipients array is provided, uses index-based matching (r1 -> recipients[0], etc.).
  Otherwise, uses email-based matching from createdRecipients.
*/
export const findRecipientByPlaceholder = (
  recipientPlaceholder: string,
  placeholder: string,
  recipients: Pick<Recipient, 'id' | 'email'>[] | undefined,
  createdRecipients: Pick<Recipient, 'id' | 'email'>[],
): Pick<Recipient, 'id' | 'email'> => {
  if (recipients && recipients.length > 0) {
    /*
      Map placeholder by index: r1 -> recipients[0], r2 -> recipients[1], etc.
      recipientIndex is 1-based, so we subtract 1 to get the array index.
    */
    const { recipientIndex } = extractRecipientPlaceholder(recipientPlaceholder);
    const recipientArrayIndex = recipientIndex - 1;

    if (recipientArrayIndex < 0 || recipientArrayIndex >= recipients.length) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Recipient placeholder ${recipientPlaceholder} (index ${recipientIndex}) is out of range. Provided ${recipients.length} recipient(s).`,
      });
    }

    return recipients[recipientArrayIndex];
  }

  /*
    Use email-based matching for placeholder recipients.
  */
  const { email } = extractRecipientPlaceholder(recipientPlaceholder);
  const recipient = createdRecipients.find((r) => r.email === email);

  if (!recipient) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Could not find recipient ID for placeholder: ${placeholder}`,
    });
  }

  return recipient;
};
