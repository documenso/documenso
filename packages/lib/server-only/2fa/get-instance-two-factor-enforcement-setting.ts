import { prisma } from '@documenso/prisma';

import { isInstanceTwoFactorEnforcementActive } from '../../utils/two-factor';
import { assertLicensedFor } from '../license/assert-licensed-for';
import type { TSiteSettingsTwoFactorEnforcementSchema } from '../site-settings/schemas/two-factor-enforcement';
import {
  SITE_SETTINGS_TWO_FACTOR_ENFORCEMENT_ID,
  ZSiteSettingsTwoFactorEnforcementSchema,
} from '../site-settings/schemas/two-factor-enforcement';

/**
 * Returns the instance-wide 2FA enforcement setting, or `null` when
 * enforcement is not active.
 *
 * Enforcement is only active when the `site.two-factor-enforcement` row
 * exists, parses, is enabled, AND the license grants
 * `instanceTwoFactorEnforcement` — a manually inserted row on an unlicensed
 * instance is a silent noop.
 *
 * Enforcement code must read only this getter. Admin settings UI which needs
 * the raw "configured but inactive" values uses its own config getter.
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

    // A malformed row is treated as unconfigured rather than throwing, so a
    // bad manual insert cannot break every enforcement check.
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
