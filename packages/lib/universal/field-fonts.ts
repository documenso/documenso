export const DEFAULT_FIELD_RENDER_FONT_FAMILY =
  '"Noto Sans", "Noto Sans Japanese", "Noto Sans Chinese", "Noto Sans Korean", sans-serif';

export type FieldFontOption = {
  id: string;
  name: string;
  family: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

export const isUploadedFieldFontFamily = (fontFamily: string | undefined | null) => {
  return Boolean(fontFamily && /^[A-Za-z0-9_-]+$/.test(fontFamily));
};

export const getFieldRenderFontFamily = (fontFamily: string | undefined | null) => {
  if (!isUploadedFieldFontFamily(fontFamily)) {
    return DEFAULT_FIELD_RENDER_FONT_FAMILY;
  }

  return `"${fontFamily}", ${DEFAULT_FIELD_RENDER_FONT_FAMILY}`;
};

export const getUploadedFieldFontIds = (fields: { fieldMeta?: unknown }[]) => {
  const fontIds = new Set<string>();

  for (const field of fields) {
    if (!isRecord(field.fieldMeta)) {
      continue;
    }

    const fontFamily = field.fieldMeta.fontFamily;

    if (typeof fontFamily === 'string' && isUploadedFieldFontFamily(fontFamily)) {
      fontIds.add(fontFamily);
    }
  }

  return Array.from(fontIds);
};
