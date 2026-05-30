import type { OrganisationGlobalSettings } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';
import { ZBrandingLogoSizeSchema } from '../constants/organisations';

export const teamGlobalSettingsToBranding = (
  settings: Omit<OrganisationGlobalSettings, 'id'>,
  teamId: number,
  hidePoweredBy: boolean,
) => {
  const brandingLogoSize = ZBrandingLogoSizeSchema.safeParse(settings.brandingLogoSize).data;

  return {
    ...settings,
    brandingLogo:
      settings.brandingEnabled && settings.brandingLogo
        ? `${NEXT_PUBLIC_WEBAPP_URL()}/api/branding/logo/team/${teamId}`
        : '',
    brandingLogoSize,
    brandingHidePoweredBy: hidePoweredBy,
  };
};

export const organisationGlobalSettingsToBranding = (
  settings: Omit<OrganisationGlobalSettings, 'id'>,
  organisationId: string,
  hidePoweredBy: boolean,
) => {
  const brandingLogoSize = ZBrandingLogoSizeSchema.safeParse(settings.brandingLogoSize).data;

  return {
    ...settings,
    brandingLogo:
      settings.brandingEnabled && settings.brandingLogo
        ? `${NEXT_PUBLIC_WEBAPP_URL()}/api/branding/logo/organisation/${organisationId}`
        : '',
    brandingLogoSize,
    brandingHidePoweredBy: hidePoweredBy,
  };
};
