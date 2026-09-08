import { z } from 'zod';

import { ZSiteSettingsBaseSchema } from './_base';

export const SITE_SETTINGS_TWO_FACTOR_ENFORCEMENT_ID = 'site.two-factor-enforcement';

export const ZSiteSettingsTwoFactorEnforcementSchema = ZSiteSettingsBaseSchema.extend({
  id: z.literal(SITE_SETTINGS_TWO_FACTOR_ENFORCEMENT_ID),
  data: z
    .object({
      gracePeriodDays: z.number().int().min(0).max(365),
      /**
       * Set server-side on each off→on transition of `enabled`, preserved
       * otherwise. ISO datetime string, or null when never enabled.
       */
      enforcedFrom: z.string().datetime().nullable(),
    })
    .optional()
    .default({
      gracePeriodDays: 7,
      enforcedFrom: null,
    }),
});

export type TSiteSettingsTwoFactorEnforcementSchema = z.infer<typeof ZSiteSettingsTwoFactorEnforcementSchema>;
