import { describe, expect, it } from 'vitest';

import { DEFAULT_FIELD_RENDER_FONT_FAMILY, getFieldRenderFontFamily, getUploadedFieldFontIds } from './field-fonts';

describe('field fonts', () => {
  it('uses the default font family when no uploaded font is selected', () => {
    expect(getFieldRenderFontFamily('')).toBe(DEFAULT_FIELD_RENDER_FONT_FAMILY);
    expect(getFieldRenderFontFamily(null)).toBe(DEFAULT_FIELD_RENDER_FONT_FAMILY);
  });

  it('prepends uploaded font ids to the default fallback stack', () => {
    expect(getFieldRenderFontFamily('font_asset_123')).toBe(`"font_asset_123", ${DEFAULT_FIELD_RENDER_FONT_FAMILY}`);
  });

  it('extracts unique uploaded font ids from field metadata', () => {
    expect(
      getUploadedFieldFontIds([
        { fieldMeta: { fontFamily: 'font_a' } },
        { fieldMeta: { fontFamily: 'font_a' } },
        { fieldMeta: { fontFamily: '' } },
        { fieldMeta: null },
      ]),
    ).toEqual(['font_a']);
  });
});
