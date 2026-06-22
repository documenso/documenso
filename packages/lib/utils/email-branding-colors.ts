import { colord } from 'colord';

import { DEFAULT_BRAND_COLORS } from '../constants/theme';
import type { TCssVarsSchema } from '../types/css-vars';

/**
 * The `brandingColors` tokens that emails actually render — the canonical
 * subset of `TCssVarsSchema`. `TCssVarsSchema` is the single source of truth
 * for token names; this tuple just selects the ones email templates use, and
 * both the `EmailBrandingColors` type and the resolver below derive from it.
 */
export const EMAIL_BRANDING_COLOR_KEYS = [
  'background',
  'foreground',
  'muted',
  'mutedForeground',
  'primary',
  'primaryForeground',
  'secondary',
  'secondaryForeground',
  'accent',
  'accentForeground',
  'destructive',
  'destructiveForeground',
  'warning',
  'border',
] as const satisfies readonly (keyof TCssVarsSchema)[];

export type EmailBrandingColorKey = (typeof EMAIL_BRANDING_COLOR_KEYS)[number];

/**
 * Resolved, email-ready brand colour set.
 *
 * Emails cannot use CSS variables, so every value here is a concrete hex
 * string. This is the shape carried through the email branding context and
 * injected into the per-render Tailwind config.
 *
 * Derived from `TCssVarsSchema` (the persisted shape) by narrowing to the
 * email token subset and making every field required: the resolver fills every
 * token (tenant value or Documenso default), so consumers never see `undefined`.
 *
 * Produced by `resolveEmailBrandingColors`, or `null` when the tenant has no
 * usable/safe colour set (callers fall back to the default Documenso palette).
 */
export type EmailBrandingColors = Required<Pick<TCssVarsSchema, EmailBrandingColorKey>>;

/**
 * Normalise an arbitrary stored colour value (hex or any colord-parseable
 * string) to a hex string. Returns `null` for missing/invalid input.
 *
 * `brandingColors` is validated loosely (`z.string()`) so values are not
 * guaranteed to be valid colours — parse defensively.
 */
export const normalizeColorToHex = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const parsed = colord(value);

  if (!parsed.isValid()) {
    return null;
  }

  return parsed.toHex();
};

/**
 * Resolve a tenant's stored `brandingColors` into an email-ready colour set.
 *
 * Each token is taken from the tenant value when it parses to a valid colour,
 * otherwise the Documenso default. We do NOT enforce contrast or readability —
 * if a tenant picks a low-contrast combination that is their choice; the
 * preview UI can hint at it, but the renderer just applies what was set.
 *
 * Returns `null` (⇒ caller uses the default Documenso palette) only when there
 * is no `brandingColors` object at all.
 */
export const resolveEmailBrandingColors = (
  brandingColors: TCssVarsSchema | null | undefined,
): EmailBrandingColors | null => {
  if (!brandingColors) {
    return null;
  }

  const resolve = (value: string | null | undefined, fallback: string): string =>
    normalizeColorToHex(value) ?? fallback;

  return {
    background: resolve(brandingColors.background, DEFAULT_BRAND_COLORS.background),
    foreground: resolve(brandingColors.foreground, DEFAULT_BRAND_COLORS.foreground),
    muted: resolve(brandingColors.muted, DEFAULT_BRAND_COLORS.muted),
    mutedForeground: resolve(brandingColors.mutedForeground, DEFAULT_BRAND_COLORS.mutedForeground),
    primary: resolve(brandingColors.primary, DEFAULT_BRAND_COLORS.primary),
    primaryForeground: resolve(brandingColors.primaryForeground, DEFAULT_BRAND_COLORS.primaryForeground),
    secondary: resolve(brandingColors.secondary, DEFAULT_BRAND_COLORS.secondary),
    secondaryForeground: resolve(brandingColors.secondaryForeground, DEFAULT_BRAND_COLORS.secondaryForeground),
    accent: resolve(brandingColors.accent, DEFAULT_BRAND_COLORS.accent),
    accentForeground: resolve(brandingColors.accentForeground, DEFAULT_BRAND_COLORS.accentForeground),
    destructive: resolve(brandingColors.destructive, DEFAULT_BRAND_COLORS.destructive),
    destructiveForeground: resolve(brandingColors.destructiveForeground, DEFAULT_BRAND_COLORS.destructiveForeground),
    warning: resolve(brandingColors.warning, DEFAULT_BRAND_COLORS.warning),
    border: resolve(brandingColors.border, DEFAULT_BRAND_COLORS.border),
  };
};
