import { describe, expect, it } from 'vitest';

import { buildFontFaceCss } from './font-face-css';

describe('buildFontFaceCss', () => {
  it('deduplicates font ids before building font-face rules', () => {
    const css = buildFontFaceCss(['font_a', 'font_a', 'font_b']);

    expect(css.match(/@font-face/g)).toHaveLength(2);
    expect(css).toContain('font-family:"font_a"');
    expect(css).toContain('font-family:"font_b"');
  });
});
