import { CSS_LENGTH_REGEX, type TCssVarsSchema } from '@documenso/lib/types/css-vars';
import { colord } from 'colord';
import { toKebabCase } from 'remeda';

export const toNativeCssVars = (vars: TCssVarsSchema) => {
  const cssVars: Record<string, string> = {};

  const { radius, ...colorVars } = vars;

  for (const [key, value] of Object.entries(colorVars)) {
    if (value) {
      const color = colord(value);
      const { h, s, l } = color.toHsl();

      // Tailwind's theme.css consumes these via `hsl(var(--token))`. CSS
      // Color 4 space-separated `hsl()` requires `%` on saturation and
      // lightness — without it, the function is invalid and the property
      // falls back to its initial value (which is why bare numeric output
      // here used to silently break customer colours).
      cssVars[`--${toKebabCase(key)}`] = `${h} ${s}% ${l}%`;
    }
  }

  // Defence in depth: radius is interpolated raw into the rendered <style>
  // block, so anything outside the length pattern is a CSS-injection vector.
  // The Zod schema rejects bad values at the API boundary; this re-check
  // protects against schema drift and any path that bypasses validation.
  if (radius && CSS_LENGTH_REGEX.test(radius)) {
    cssVars[`--radius`] = radius;
  }

  return cssVars;
};

/**
 * Pure-string sibling of `toNativeCssVars` — returns the same set of CSS custom
 * property declarations as a single string suitable for SSR inlining inside a
 * rule block. Does not touch the DOM.
 *
 * Example: { background: '#111', radius: '0.5rem' }
 *  -> "--background: 0 0% 6.7%; --radius: 0.5rem;"
 *
 * Saturation and lightness include the `%` suffix that
 * `hsl(var(--token))` requires under CSS Color 4 space-separated syntax.
 */
export const toNativeCssVarsString = (vars: TCssVarsSchema): string => {
  const map = toNativeCssVars(vars);
  return Object.entries(map)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
};

export const injectCss = (options: { css?: string; cssVars?: TCssVarsSchema }) => {
  const { css, cssVars } = options;

  if (css) {
    const style = document.createElement('style');
    style.textContent = css;

    document.head.appendChild(style);
  }

  if (cssVars) {
    const nativeVars = toNativeCssVars(cssVars);

    for (const [key, value] of Object.entries(nativeVars)) {
      document.documentElement.style.setProperty(key, value);
    }
  }
};
