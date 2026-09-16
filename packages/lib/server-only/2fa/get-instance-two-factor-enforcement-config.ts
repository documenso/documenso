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

  /**
   * Whether enforcement is currently active (enabled AND licensed) — the same
   * activation decision the policy getter applies.
   */
  isActive: boolean;
};

/**
 * Returns the raw stored instance 2FA enforcement configuration (schema
 * defaults when the row is absent or malformed) together with the license and
 * activation state.
 *
 * FOR ADMIN SETTINGS ONLY — never use this from enforcement code. Enforcement
 * reads `getInstanceTwoFactorEnforcementSetting()`, which returns `null`
 * unless the policy is actually active. This getter deliberately exposes the
 * stored values that the policy getter hides so the admin UI can render the
 * "configured but inactive" (e.g. license lapsed) state with a disable-only
 * affordance.
 */
export const getInstanceTwoFactorEnforcementConfig = async (): Promise<TInstanceTwoFactorEnforcementConfig> => {
  const settingRow = await prisma.siteSettings.findFirst({
    where: {
      id: SITE_SETTINGS_TWO_FACTOR_ENFORCEMENT_ID,
    },
  });

  // A missing or malformed row is presented as the unconfigured defaults,
  // mirroring how the policy getter treats it as unconfigured.
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
