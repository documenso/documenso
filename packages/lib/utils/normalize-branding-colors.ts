import type { TCssVarsSchema } from '../types/css-vars';

/**
 * Normalise a branding-colours payload coming from a settings form.
 *
 * The colour-pickers store empty strings for cleared fields, and
 * `ZCssVarsSchema.default({})` produces `{}` when the form is submitted
 * without any colour overrides. Persisting either as a non-null value would
 * silently mask the org's defaults for a team, and produce noisy "this is
 * an override of nothing" rows in the database.
 *
 * This helper:
 *  - strips keys whose value is `undefined`, `null`, or an empty string
 *  - returns `null` if the result has no remaining keys
 *  - leaves all other keys verbatim (validation against ZCssVarsSchema is
 *    expected to have happened at the request boundary)
 *
 * `undefined` input means "no change" — the caller should not pass it
 * through to Prisma. We pass it through unchanged so handlers can keep their
 * existing `=== undefined` branches.
 */
export const normalizeBrandingColors = (
  input: TCssVarsSchema | null | undefined,
): TCssVarsSchema | null | undefined => {
  if (input === undefined) {
    return undefined;
  }

  if (input === null) {
    return null;
  }

  const cleaned: Record<string, string> = {};

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.trim() !== '') {
      cleaned[key] = value;
    }
  }

  if (Object.keys(cleaned).length === 0) {
    return null;
  }

  return cleaned as TCssVarsSchema;
};
