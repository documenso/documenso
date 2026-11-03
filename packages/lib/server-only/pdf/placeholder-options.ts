import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { FieldType } from '@prisma/client';
import { match } from 'ts-pattern';

type OptionFieldType = typeof FieldType.CHECKBOX | typeof FieldType.RADIO | typeof FieldType.DROPDOWN;

export const isOptionFieldType = (fieldType: FieldType): fieldType is OptionFieldType => {
  return fieldType === FieldType.CHECKBOX || fieldType === FieldType.RADIO || fieldType === FieldType.DROPDOWN;
};

/*
  Split placeholder content on commas outside double quotes, so a quoted option
  list such as `values="Option A, detailed|Option B"` stays a single property.
  Quotes are kept; parsePlaceholderOptionList validates and strips them.

  E.g. 'checkbox, r1, values="A, B|C"' -> ['checkbox', 'r1', 'values="A, B|C"']
*/
export const splitPlaceholderProperties = (content: string): string[] => {
  const properties: string[] = [];

  let current = '';
  let isInsideQuotes = false;

  for (const char of content) {
    if (char === '"') {
      isInsideQuotes = !isInsideQuotes;
    }

    if (char === ',' && !isInsideQuotes) {
      properties.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  properties.push(current.trim());

  return properties;
};

/*
  Parse an option list such as `Yes|No` or `"A, detailed|B"` into its options.

  - Options are separated by `|`; `\|` is a literal pipe.
  - `\%` is decoded to `%`, since LaTeX requires `\%` and it can leak into the PDF text layer.
  - A list containing commas must be quoted as a whole. Per-option quotes are rejected.
*/
export const parsePlaceholderOptionList = (rawList: string): string[] => {
  let list = rawList.trim();

  if (list.startsWith('"')) {
    if (list.length < 2 || !list.endsWith('"')) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Option list has an unclosed quote',
      });
    }

    list = list.slice(1, -1);
  }

  if (list.includes('"')) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Quote the whole option list (e.g. values="A, B|C"), not individual options',
    });
  }

  if (list.trim() === '') {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Option list must contain at least one option',
    });
  }

  const options: string[] = [];
  let current = '';

  for (let index = 0; index < list.length; index++) {
    const char = list[index];
    const nextChar = list[index + 1];

    if (char === '\\' && (nextChar === '|' || nextChar === '%')) {
      current += nextChar;
      index++;
      continue;
    }

    if (char === '|') {
      options.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  options.push(current.trim());

  if (options.some((option) => option === '')) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Option list contains an empty option',
    });
  }

  return options;
};

/*
  Build the checkbox, radio or dropdown option meta from the `values=` (or `options=`)
  and `default=` placeholder properties, in the same shape the field editor produces.
*/
export const parseOptionFieldMetaFromPlaceholder = (
  rawFieldMeta: Record<string, string>,
  fieldType: OptionFieldType,
): Record<string, unknown> => {
  if (rawFieldMeta.values !== undefined && rawFieldMeta.options !== undefined) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Use either values= or options=, not both',
    });
  }

  const rawValues = rawFieldMeta.values ?? rawFieldMeta.options;
  const rawDefault = rawFieldMeta.default;

  if (rawValues === undefined) {
    if (rawDefault !== undefined) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'default= requires values= or options=',
      });
    }

    return {};
  }

  const values = parsePlaceholderOptionList(rawValues);

  const duplicate = values.find((value, index) => values.indexOf(value) !== index);

  if (duplicate !== undefined) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Option "${duplicate}" is listed more than once`,
    });
  }

  const defaults = rawDefault === undefined ? [] : [...new Set(parsePlaceholderOptionList(rawDefault))];

  const unknownDefault = defaults.find((value) => !values.includes(value));

  if (unknownDefault !== undefined) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Default "${unknownDefault}" is not one of the options`,
    });
  }

  if (fieldType !== FieldType.CHECKBOX && defaults.length > 1) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `${fieldType.toLowerCase()} fields accept a single default`,
    });
  }

  return match(fieldType)
    .with(FieldType.DROPDOWN, () => ({
      values: values.map((value) => ({ value })),
      ...(defaults.length > 0 ? { defaultValue: defaults[0] } : {}),
    }))
    .otherwise(() => ({
      values: values.map((value, index) => ({ id: index + 1, checked: defaults.includes(value), value })),
    }));
};
