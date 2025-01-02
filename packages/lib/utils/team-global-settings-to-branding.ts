import type { TeamGlobalSettings } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';

export const teamGlobalSettingsToBranding = (teamGlobalSettings: TeamGlobalSettings) => {
  return {
    ...teamGlobalSettings,
    brandingLogo:
      teamGlobalSettings.brandingEnabled && teamGlobalSettings.brandingLogo
        ? `${NEXT_PUBLIC_WEBAPP_URL()}/api/branding/logo/team/${teamGlobalSettings.teamId}`
        : '',
  };
};
