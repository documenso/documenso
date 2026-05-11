import { IS_BILLING_ENABLED } from '../../constants/app';
import type { TCssVarsSchema } from '../../types/css-vars';
import { ZCssVarsSchema } from '../../types/css-vars';
import { getOrganisationClaimByTeamId } from '../organisation/get-organisation-claims';
import { getTeamSettings } from '../team/get-team-settings';

export type RecipientBrandingPayload = {
  allowCustomBranding: boolean;
  hidePoweredBy: boolean;
  colors: TCssVarsSchema | null;
  css: string | null;
};

/**
 * Resolve the branding payload for a recipient-facing route, given the team
 * the envelope/document belongs to. Reads inherited team-or-org branding settings,
 * checks the org's claim flags, and returns a payload safe to send to the client.
 *
 * Returns a minimal disabled payload if the team is not on a plan that allows
 * custom branding.
 */
export const loadRecipientBrandingByTeamId = async ({
  teamId,
}: {
  teamId: number;
}): Promise<RecipientBrandingPayload> => {
  const billingEnabled = IS_BILLING_ENABLED();

  const [settings, claim] = await Promise.all([
    getTeamSettings({ teamId }),
    billingEnabled ? getOrganisationClaimByTeamId({ teamId }).catch(() => null) : Promise.resolve(null),
  ]);

  const allowCustomBranding = !billingEnabled || claim?.flags?.embedSigningWhiteLabel === true;
  const hidePoweredBy = !billingEnabled || claim?.flags?.hidePoweredBy === true;

  if (!allowCustomBranding) {
    return {
      allowCustomBranding: false,
      hidePoweredBy,
      colors: null,
      css: null,
    };
  }

  // brandingColors is stored as JSON; parse defensively. Drop unknown keys via Zod.
  const parsedColors = settings.brandingColors ? ZCssVarsSchema.safeParse(settings.brandingColors) : null;

  return {
    allowCustomBranding: true,
    hidePoweredBy,
    colors: parsedColors?.success ? parsedColors.data : null,
    css: settings.brandingCss && settings.brandingCss.length > 0 ? settings.brandingCss : null,
  };
};
