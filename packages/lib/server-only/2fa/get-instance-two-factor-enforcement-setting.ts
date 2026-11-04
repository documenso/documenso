import { prisma } from '@documenso/prisma';

import { isInstanceTwoFactorEnforcementActive } from '../../utils/two-factor';
import { assertLicensedFor } from '../license/assert-licensed-for';
import type { TSiteSettingsTwoFactorEnforcementSchema } from '../site-settings/schemas/two-factor-enforcement';
import {
  SITE_SETTINGS_TWO_FACTOR_ENFORCEMENT_ID,
  ZSiteSettingsTwoFactorEnforcementSchema,
} from '../site-settings/schemas/two-factor-enforcement';

/**
 * Returns `null` unless the setting is enabled AND licensed, so a manually
 * inserted row on an unlicensed instance is a silent noop.
 */
export const getInstanceTwoFactorEnforcementSetting =
  async (): Promise<TSiteSettingsTwoFactorEnforcementSchema | null> => {
    const settingRow = await prisma.siteSettings.findFirst({
      where: {
        id: SITE_SETTINGS_TWO_FACTOR_ENFORCEMENT_ID,
      },
    });

    if (!settingRow) {
      return null;
    }

    // A malformed row must not break every enforcement check.
    const parsedSetting = ZSiteSettingsTwoFactorEnforcementSchema.safeParse(settingRow);

    if (!parsedSetting.success) {
      return null;
    }

    const isLicensed = await assertLicensedFor('instanceTwoFactorEnforcement')
      .then(() => true)
      .catch(() => false);

    if (!isInstanceTwoFactorEnforcementActive({ setting: parsedSetting.data, isLicensed })) {
      return null;
    }

    return parsedSetting.data;
  };
