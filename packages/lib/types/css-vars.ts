import { z } from 'zod';

/**
 * A CSS length value: `0`, or a positive number followed by a length unit.
 * Used for the radius field, which is interpolated raw into a `<style>`
 * block at render time. Anything outside this shape is a CSS-injection
 * vector — DO NOT loosen without re-checking `toNativeCssVars`.
 */
export const CSS_LENGTH_REGEX = /^(0|\d+(\.\d+)?(rem|px|em|%|pt|))$/i;

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
    radius: z
      .string()
      .regex(CSS_LENGTH_REGEX, 'Must be a CSS length such as 0.5rem, 8px, or 0')
      .optional()
      .describe('Border radius — must be a CSS length (rem/px/em/%/pt or 0)'),
    warning: z.string().optional().describe('Warning/alert color'),
    envelopeEditorBackground: z.string().optional().describe('Envelope editor background color'),
  })
  .describe('Custom CSS variables for theming');

export type TCssVarsSchema = z.infer<typeof ZCssVarsSchema>;
