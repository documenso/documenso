import { prisma } from '@documenso/prisma';

import type { InstanceTwoFactorEnforcementStoredConfig } from '../../utils/two-factor';
import { isInstanceTwoFactorEnforcementActive } from '../../utils/two-factor';
import { assertLicensedFor } from '../license/assert-licensed-for';
import {
  SITE_SETTINGS_TWO_FACTOR_ENFORCEMENT_ID,
  ZSiteSettingsTwoFactorEnforcementSchema,
} from '../site-settings/schemas/two-factor-enforcement';

export type TInstanceTwoFactorEnforcementConfig = InstanceTwoFactorEnforcementStoredConfig & {
  isLicensed: boolean;

  isActive: boolean;
};

/**
 * For admin settings only, never use this from enforcement code. Enforcement
 * reads `getInstanceTwoFactorEnforcementSetting()`, which returns `null` unless
 * the policy is actually active; this exposes the stored values regardless so
 * the admin UI can render the "configured but inactive" state.
 */
export const getInstanceTwoFactorEnforcementConfig = async (): Promise<TInstanceTwoFactorEnforcementConfig> => {
  const settingRow = await prisma.siteSettings.findFirst({
    where: {
      id: SITE_SETTINGS_TWO_FACTOR_ENFORCEMENT_ID,
    },
  });

  const parsedSetting = settingRow ? ZSiteSettingsTwoFactorEnforcementSchema.safeParse(settingRow) : null;

  const storedConfig: InstanceTwoFactorEnforcementStoredConfig = parsedSetting?.success
    ? {
        enabled: parsedSetting.data.enabled,
        gracePeriodDays: parsedSetting.data.data.gracePeriodDays,
        enforcedFrom: parsedSetting.data.data.enforcedFrom,
      }
    : {
        enabled: false,
        gracePeriodDays: 7,
        enforcedFrom: null,
      };

  const isLicensed = await assertLicensedFor('instanceTwoFactorEnforcement')
    .then(() => true)
    .catch(() => false);

  return {
    ...storedConfig,
    isLicensed,
    isActive: isInstanceTwoFactorEnforcementActive({
      setting: { enabled: storedConfig.enabled },
      isLicensed,
    }),
  };
};
