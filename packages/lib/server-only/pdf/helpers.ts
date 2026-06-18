import path from 'node:path';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { Recipient } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { FontLibrary } from 'skia-canvas';
import { match } from 'ts-pattern';

/**
 * Ensure all required fonts are registered in the skia-canvas FontLibrary.
 *
 * Fonts are registered once per process and retained — calling this multiple
 * times is a no-op after the first invocation.
 */
export const ensureFontLibrary = () => {
  const fontPath = path.join(process.cwd(), 'public/fonts');

  if (!FontLibrary.has('Caveat')) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    FontLibrary.use({
      ['Caveat']: [path.join(fontPath, 'caveat.ttf')],
    });
  }

  if (!FontLibrary.has('Inter')) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    FontLibrary.use({
      ['Inter']: [path.join(fontPath, 'inter-variablefont_opsz,wght.ttf')],
    });
  }

  if (!FontLibrary.has('Noto Sans')) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    FontLibrary.use({
      ['Noto Sans']: [path.join(fontPath, 'noto-sans.ttf')],
      ['Noto Sans Japanese']: [path.join(fontPath, 'noto-sans-japanese.ttf')],
      ['Noto Sans Chinese']: [path.join(fontPath, 'noto-sans-chinese.ttf')],
      ['Noto Sans Korean']: [path.join(fontPath, 'noto-sans-korean.ttf')],
    });
  }
};

type RecipientPlaceholderInfo = {
  email: string;
  name: string;
  recipientIndex: number;
};

const CHECKBOX_VALIDATION_RULE_BY_ALIAS: Record<string, string> = {
  atLeast: 'Select at least',
  exactly: 'Select exactly',
  atMost: 'Select at most',
};

/*
  Split a string on a delimiter, treating `\` as an escape for the next character.
  Delimiters preceded by `\` are kept in the output instead of splitting (e.g. `\,`, `\=`, `\|`).

  With delimiter ',' (top-level placeholder parts):
  'radio, r1, options=Card/Check|Bank Transfer, selected=Bank Transfer'
    -> ['radio', ' r1', ' options=Card/Check|Bank Transfer', ' selected=Bank Transfer']

  With delimiter '=' (split one field metadata token into key + value):
  'options=Card/Check|Bank Transfer'
    -> ['options', 'Card/Check|Bank Transfer']

  With delimiter '|' (split option list inside 'options='):
  'Card/Check|Bank Transfer'
    -> ['Card/Check', 'Bank Transfer']
*/
const splitPlaceholderToken = (value: string, delimiter: string): string[] => {
  const parts: string[] = [];
  let currentPart = '';

  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    const nextChar = value[index + 1];

    if (char === '\\' && nextChar) {
      currentPart += char + nextChar;
      index++;
      continue;
    }

    if (char === delimiter) {
      parts.push(currentPart);
      currentPart = '';
      continue;
    }

    currentPart += char;
  }

  parts.push(currentPart);

  return parts;
};

/*
  Split a metadata token (e.g. 'required=true') into [key, value].
  Splits on the first unescaped '='; returns null if there is no key or value.

  E.g.
  'options=Card/Check|Bank Transfer' -> ['options', 'Card/Check|Bank Transfer']
  'required=true'                    -> ['required', 'true']
*/
const splitPlaceholderKeyValue = (value: string): [string, string] | null => {
  const [key, ...valueParts] = splitPlaceholderToken(value, '=');

  if (!key || valueParts.length === 0) {
    return null;
  }

  return [key.trim(), valueParts.join('=').trim()];
};

const unescapePlaceholderValue = (value: string): string => {
  return value.replace(/\\([,=|\\])/g, '$1');
};

const normalizePlaceholderSelectionValue = (value: string): string => {
  return unescapePlaceholderValue(value).replace(/\s+/g, ' ').trim();
};

/*
  Split an options string into individual choices.
  Splits on unescaped '|', then unescapes, trims, and drops empty entries.

  E.g.
  'Card/Check|Bank Transfer'     -> ['Card/Check', 'Bank Transfer']
  'Card\\|Check|Bank Transfer'   -> ['Card|Check', 'Bank Transfer']
*/
const parsePlaceholderOptions = (value: string): string[] => {
  return splitPlaceholderToken(value, '|')
    .map((option) => normalizePlaceholderSelectionValue(option))
    .filter((option) => option.length > 0);
};

/*
  Split a placeholder string into top-level parts (field type, recipient, metadata).
  Splits on unescaped commas, then trims whitespace.

  E.g.
  'SIGNATURE, r1, required=true'
    -> ['SIGNATURE', 'r1', 'required=true']
*/
export const parsePlaceholderData = (value: string): string[] => {
  return splitPlaceholderToken(value, ',').map((token) => token.trim());
};

export const parseRawFieldMetaFromPlaceholder = (fieldMetaData: string[]): Record<string, string> => {
  const rawFieldMeta: Record<string, string> = {};

  for (const fieldMeta of fieldMetaData) {
    const keyValue = splitPlaceholderKeyValue(fieldMeta);

    if (!keyValue) {
      continue;
    }

    const [key, value] = keyValue;

    rawFieldMeta[key] = value;
  }

  return rawFieldMeta;
};

/*
  Parse field type string to FieldType enum.
  Normalizes the input (uppercase, trim) and validates it's a valid field type.
  This ensures we handle case variations and whitespace, and provides clear error messages.
*/
export const parseFieldTypeFromPlaceholder = (fieldTypeString: string): FieldType => {
  const normalizedType = fieldTypeString.toUpperCase().trim();

  return match(normalizedType)
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

const getDefaultFieldMetaValue = (rawFieldMeta: Record<string, string>) => {
  const defaultValue = rawFieldMeta.defaultValue ?? rawFieldMeta.default ?? rawFieldMeta.selected;

  return defaultValue ? normalizePlaceholderSelectionValue(defaultValue) : undefined;
};

const parseCheckboxValidationRule = (value: string): string => {
  const validationRule = CHECKBOX_VALIDATION_RULE_BY_ALIAS[value];

  if (!validationRule) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Invalid checkbox placeholder validation rule: ${value}`,
    });
  }

  return validationRule;
};

const parseSelectionFieldOptions = (
  rawFieldMeta: Record<string, string>,
  fieldType: FieldType,
): string[] | undefined => {
  const rawOptions = rawFieldMeta.options;

  if (rawOptions === undefined) {
    return;
  }

  const parsedOptions = parsePlaceholderOptions(rawOptions);

  if (parsedOptions.length === 0) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `${fieldType} placeholder options must contain at least one value`,
    });
  }

  return parsedOptions;
};

const applyRadioFieldOptions = (parsedFieldMeta: Record<string, unknown>, rawFieldMeta: Record<string, string>) => {
  const options = parseSelectionFieldOptions(rawFieldMeta, FieldType.RADIO);
  const defaultValue = getDefaultFieldMetaValue(rawFieldMeta);

  if (!options && defaultValue) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Radio placeholder default value requires options',
    });
  }

  if (!options) {
    return;
  }

  const selectedOptionIndex = defaultValue ? options.findIndex((option) => option === defaultValue) : -1;

  if (defaultValue && selectedOptionIndex === -1) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Radio placeholder default value "${defaultValue}" must match one of the options`,
    });
  }

  parsedFieldMeta.values = options.map((option, index) => ({
    id: index + 1,
    checked: index === selectedOptionIndex,
    value: option,
  }));
};

const applyCheckboxFieldOptions = (parsedFieldMeta: Record<string, unknown>, rawFieldMeta: Record<string, string>) => {
  const options = parseSelectionFieldOptions(rawFieldMeta, FieldType.CHECKBOX);
  const checkedValues = rawFieldMeta.checked ? parsePlaceholderOptions(rawFieldMeta.checked) : [];

  if (!options && checkedValues.length > 0) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Checkbox placeholder checked values require options',
    });
  }

  if (!options) {
    return;
  }

  const unmatchedCheckedValues = checkedValues.filter((checkedValue) => !options.includes(checkedValue));

  if (unmatchedCheckedValues.length > 0) {
    const unmatchedCheckedValue = unmatchedCheckedValues[0];

    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: [`Checkbox placeholder checked value "${unmatchedCheckedValue}"`, 'must match one of the options'].join(
        ' ',
      ),
    });
  }

  parsedFieldMeta.values = options.map((option, index) => ({
    id: index + 1,
    checked: checkedValues.includes(option),
    value: option,
  }));
};

const applyDropdownFieldOptions = (parsedFieldMeta: Record<string, unknown>, rawFieldMeta: Record<string, string>) => {
  const options = parseSelectionFieldOptions(rawFieldMeta, FieldType.DROPDOWN);
  const defaultValue = getDefaultFieldMetaValue(rawFieldMeta);

  if (!options && defaultValue) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Dropdown placeholder default value requires options',
    });
  }

  if (!options) {
    return;
  }

  if (defaultValue && !options.includes(defaultValue)) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Dropdown placeholder default value "${defaultValue}" must match one of the options`,
    });
  }

  parsedFieldMeta.values = options.map((option) => ({
    value: option,
  }));

  if (defaultValue) {
    parsedFieldMeta.defaultValue = defaultValue;
  }
};

/*
  Generic field metadata properties are simple properties consisting of a key and a value.
  E.g. 'required=true', 'fontSize=12', 'textAlign=left'
  They don't require special handling.

  Special field metadata properties are complex properties consisting of a key and a value with multiple parts.
  E.g. 'options=Card/Check|Bank Transfer', 'checked=Card|Check', 'selected=Bank Transfer'
  They require special handling.
*/
const shouldSkipGenericFieldMetaParsing = (property: string, fieldType: FieldType): boolean => {
  if (property === 'options' || property === 'default' || property === 'selected') {
    return true;
  }

  const isSelectionField =
    fieldType === FieldType.CHECKBOX || fieldType === FieldType.RADIO || fieldType === FieldType.DROPDOWN;

  if (!isSelectionField) {
    return false;
  }

  if (
    property === 'label' ||
    property === 'placeholder' ||
    property === 'defaultValue' ||
    (fieldType === FieldType.CHECKBOX && property === 'checked')
  ) {
    return true;
  }

  return false;
};

/*
  Transform raw field metadata from placeholder format to schema format.
  Users should provide properly capitalized property names (e.g., readOnly, fontSize, textAlign).
  Converts string values to proper types (booleans, numbers).
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

  const parsedFieldMeta: Record<string, unknown> = {
    type: fieldTypeString,
  };

  /*
    rawFieldMeta is an object with string keys and string values.
    It contains string values because the PDF parser returns the values as strings.

    E.g. { 'required': 'true', 'fontSize': '12', 'maxValue': '100', 'minValue': '0', 'characterLimit': '100' }
  */
  const rawFieldMetaEntries = Object.entries(rawFieldMeta);

  for (const [property, value] of rawFieldMetaEntries) {
    if (shouldSkipGenericFieldMetaParsing(property, fieldType)) {
      continue;
    }

    const unescapedValue = unescapePlaceholderValue(value);

    if (property === 'readOnly' || property === 'required') {
      parsedFieldMeta[property] = unescapedValue.toLowerCase() === 'true';
    } else if (property === 'validationRule' && fieldType === FieldType.CHECKBOX) {
      parsedFieldMeta[property] = parseCheckboxValidationRule(unescapedValue);
    } else if (
      property === 'fontSize' ||
      property === 'maxValue' ||
      property === 'minValue' ||
      property === 'characterLimit' ||
      property === 'validationLength'
    ) {
      const numValue = Number(unescapedValue);

      if (!Number.isNaN(numValue)) {
        parsedFieldMeta[property] = numValue;
      }
    } else {
      parsedFieldMeta[property] = unescapedValue;
    }
  }

  match(fieldType)
    .with(FieldType.RADIO, () => applyRadioFieldOptions(parsedFieldMeta, rawFieldMeta))
    .with(FieldType.CHECKBOX, () => applyCheckboxFieldOptions(parsedFieldMeta, rawFieldMeta))
    .with(FieldType.DROPDOWN, () => applyDropdownFieldOptions(parsedFieldMeta, rawFieldMeta))
    .otherwise(() => undefined);

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
