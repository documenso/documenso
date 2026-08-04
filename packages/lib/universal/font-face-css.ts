export const buildFontFaceCss = (fontIds: string[], fontUrlSearchParams = '') => {
  return [...new Set(fontIds)]
    .map(
      (fontId) =>
        `@font-face{font-family:"${fontId}";src:url("/api/fonts/${fontId}${fontUrlSearchParams}");font-display:swap;}`,
    )
    .join('\n');
};
