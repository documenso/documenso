import { colord } from 'colord';
import { toKebabCase } from 'remeda';
import { z } from 'zod';

export const ZCssVarsSchema = z
  .object({
    background: z.string().optional().describe('Base background color'),
    foreground: z.string().optional().describe('Base text color'),
    muted: z.string().optional().describe('Muted/subtle background color'),
    mutedForeground: z.string().optional().describe('Muted/subtle text color'),
    popover: z.string().optional().describe('Popover/dropdown background color'),
    popoverForeground: z.string().optional().describe('Popover/dropdown text color'),
    card: z.string().optional().describe('Card background color'),
    cardBorder: z.string().optional().describe('Card border color'),
    cardBorderTint: z.string().optional().describe('Card border tint/highlight color'),
    cardForeground: z.string().optional().describe('Card text color'),
    fieldCard: z.string().optional().describe('Field card background color'),
    fieldCardBorder: z.string().optional().describe('Field card border color'),
    fieldCardForeground: z.string().optional().describe('Field card text color'),
    widget: z.string().optional().describe('Widget background color'),
    widgetForeground: z.string().optional().describe('Widget text color'),
    border: z.string().optional().describe('Default border color'),
    input: z.string().optional().describe('Input field border color'),
    primary: z.string().optional().describe('Primary action/button color'),
    primaryForeground: z.string().optional().describe('Primary action/button text color'),
    secondary: z.string().optional().describe('Secondary action/button color'),
    secondaryForeground: z.string().optional().describe('Secondary action/button text color'),
    accent: z.string().optional().describe('Accent/highlight color'),
    accentForeground: z.string().optional().describe('Accent/highlight text color'),
    destructive: z.string().optional().describe('Destructive/danger action color'),
    destructiveForeground: z.string().optional().describe('Destructive/danger text color'),
    ring: z.string().optional().describe('Focus ring color'),
    radius: z.string().optional().describe('Border radius size in REM units'),
    warning: z.string().optional().describe('Warning/alert color'),
  })
  .describe('Custom CSS variables for theming');

export type TCssVarsSchema = z.infer<typeof ZCssVarsSchema>;

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
