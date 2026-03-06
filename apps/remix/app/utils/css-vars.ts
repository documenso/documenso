import { colord } from 'colord';
import { toKebabCase } from 'remeda';

import type { TCssVarsSchema } from '@documenso/lib/types/css-vars';

export const toNativeCssVars = (vars: TCssVarsSchema) => {
  const cssVars: Record<string, string> = {};

  const { radius, ...colorVars } = vars;

  for (const [key, value] of Object.entries(colorVars)) {
    if (value) {
      const color = colord(value);
      const { h, s, l } = color.toHsl();

      cssVars[`--${toKebabCase(key)}`] = `${h} ${s} ${l}`;
    }
  }

  if (radius) {
    cssVars[`--radius`] = `${radius}`;
  }

  return cssVars;
};

export const injectCss = (options: { css?: string; cssVars?: TCssVarsSchema }) => {
  const { css, cssVars } = options;

  if (css) {
    const style = document.createElement('style');
    style.innerHTML = css;

    document.head.appendChild(style);
  }

  if (cssVars) {
    const nativeVars = toNativeCssVars(cssVars);

    for (const [key, value] of Object.entries(nativeVars)) {
      document.documentElement.style.setProperty(key, value);
    }
  }
};
