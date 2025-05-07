import type { OrganisationGlobalSettings } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';

export const teamGlobalSettingsToBranding = (
  settings: Omit<OrganisationGlobalSettings, 'id'>,
  teamId: number,
) => {
  return {
    ...settings,
    brandingLogo:
      settings.brandingEnabled && settings.brandingLogo
        ? `${NEXT_PUBLIC_WEBAPP_URL()}/api/branding/logo/team/${teamId}` // Todo: (orgs) Handle orgs
        : '',
  };
};

// Todo: (orgs) Handle orgs
export const organisationGlobalSettingsToBranding = (
  settings: Omit<OrganisationGlobalSettings, 'id'>,
  organisationId: string,
) => {
  return {
    ...settings,
    brandingLogo:
      settings.brandingEnabled && settings.brandingLogo
        ? `${NEXT_PUBLIC_WEBAPP_URL()}/api/branding/logo/organisation/${organisationId}`
        : '',
  };
};
