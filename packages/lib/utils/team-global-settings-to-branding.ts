import type { OrganisationGlobalSettings } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';

export const teamGlobalSettingsToBranding = (
  settings: Omit<OrganisationGlobalSettings, 'id'>,
  teamId: number,
  hidePoweredBy: boolean,
) => {
  return {
    ...settings,
    brandingLogo:
      settings.brandingEnabled && settings.brandingLogo
        ? `${NEXT_PUBLIC_WEBAPP_URL()}/api/branding/logo/team/${teamId}`
        : '',
    brandingHidePoweredBy: hidePoweredBy,
  };
};

export const organisationGlobalSettingsToBranding = (
  settings: Omit<OrganisationGlobalSettings, 'id'>,
  organisationId: string,
  hidePoweredBy: boolean,
) => {
  return {
    ...settings,
    brandingLogo:
      settings.brandingEnabled && settings.brandingLogo
        ? `${NEXT_PUBLIC_WEBAPP_URL()}/api/branding/logo/organisation/${organisationId}`
        : '',
    brandingHidePoweredBy: hidePoweredBy,
  };
};
