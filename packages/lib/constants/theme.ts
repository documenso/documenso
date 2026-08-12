import type { TCssVarsSchema } from '../types/css-vars';

/**
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 *
 * KEEP THIS FILE IN SYNC WITH `packages/ui/styles/theme.css`.
 *
 * These are the light-mode default values for the CSS custom properties
 * defined under `:root` in the theme stylesheet, exposed here as hex strings
 * so they can be used as defaults for colour-picker UI components and other
 * places that don't render through CSS variables.
 *
 * If you change a value in `theme.css`, update it here too. There is NO
 * automated check linking the two files; they have drifted historically
 * and will drift again unless you update both.
 *
 * Computed via `colord({ h, s, l }).toHex()` — see the inline HSL comments
 * for the source-of-truth values from `theme.css`.
 *
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 */
export const DEFAULT_BRAND_COLORS = {
  background: '#ffffff', //              0 0% 100%
  foreground: '#0f172a', //              222.2 47.4% 11.2%
  muted: '#f1f5f9', //                   210 40% 96.1%
  mutedForeground: '#64748b', //         215.4 16.3% 46.9%
  popover: '#ffffff', //                 0 0% 100%
  popoverForeground: '#0f172a', //       222.2 47.4% 11.2%
  card: '#ffffff', //                    0 0% 100%
  cardBorder: '#e2e8f0', //              214.3 31.8% 91.4%
  cardForeground: '#0f172a', //          222.2 47.4% 11.2%
  fieldCard: '#e2f8d3', //               95 74% 90%
  fieldCardBorder: '#a2e771', //         95.08 71.08% 67.45%
  fieldCardForeground: '#0f172a', //     222.2 47.4% 11.2%
  widget: '#f7f7f7', //                  0 0% 97%
  widgetForeground: '#f2f2f2', //        0 0% 95%
  border: '#e2e8f0', //                  214.3 31.8% 91.4%
  input: '#e2e8f0', //                   214.3 31.8% 91.4%
  primary: '#a2e771', //                 95.08 71.08% 67.45%
  primaryForeground: '#162c07', //       95.08 71.08% 10%
  secondary: '#f1f5f9', //               210 40% 96.1%
  secondaryForeground: '#0f172a', //     222.2 47.4% 11.2%
  accent: '#f1f5f9', //                  210 40% 96.1%
  accentForeground: '#0f172a', //        222.2 47.4% 11.2%
  destructive: '#ff0000', //             0 100% 50%
  destructiveForeground: '#f8fafc', //   210 40% 98%
  ring: '#a2e771', //                    95.08 71.08% 67.45%
  warning: '#e1cb05', //                 54 96% 45%
  envelopeEditorBackground: '#f8fafc', //210 40% 98.04%
  // `cardBorderTint` is intentionally excluded from the colour-picker UI:
  // unlike the rest of these tokens it is consumed via `rgb(var(--token))`
  // (not `hsl(...)`) and stored as raw RGB triplets in `theme.css`. It does
  // not flow through `toNativeCssVars` and is not user-customisable from the
  // branding form. `radius` is a length, not a colour, so it lives in
  // `DEFAULT_BRAND_RADIUS` below.
} as const satisfies Record<keyof Omit<TCssVarsSchema, 'radius' | 'cardBorderTint'>, string>;

export const DEFAULT_BRAND_RADIUS = '0.5rem';
