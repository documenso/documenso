import type { TBaseFieldMeta } from '../types/field-meta';

export type FieldTextStyleMeta = {
  fontWeight?: TBaseFieldMeta['fontWeight'] | null;
  fontStyle?: TBaseFieldMeta['fontStyle'] | null;
};

export const getFieldTextStyle = (fieldMeta: FieldTextStyleMeta | null | undefined) => {
  return {
    fontWeight: fieldMeta?.fontWeight === 'bold' ? 700 : 400,
    fontStyle: fieldMeta?.fontStyle === 'italic' ? 'italic' : 'normal',
  } as const;
};

export const getKonvaFieldTextStyle = (fieldMeta: FieldTextStyleMeta | null | undefined) => {
  const isBold = fieldMeta?.fontWeight === 'bold';
  const isItalic = fieldMeta?.fontStyle === 'italic';

  if (isBold && isItalic) {
    return {
      fontStyle: 'bold italic',
    } as const;
  }

  if (isBold) {
    return {
      fontStyle: 'bold',
    } as const;
  }

  if (isItalic) {
    return {
      fontStyle: 'italic',
    } as const;
  }

  return {
    fontStyle: 'normal',
  } as const;
};
