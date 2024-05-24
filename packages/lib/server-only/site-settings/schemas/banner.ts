import { z } from 'zod';

import { ZSiteSettingsBaseSchema } from './_base';

export const SITE_SETTINGS_BANNER_ID = 'site.banner';

export const ZSiteSettingsBannerSchema = ZSiteSettingsBaseSchema.extend({
  id: z.literal(SITE_SETTINGS_BANNER_ID),
  data: z
    .object({
      content: z.string(),
      bgColor: z.string(),
      textColor: z.string(),
    })
    .optional()
    .default({
      content: '',
      bgColor: '#000000',
      textColor: '#FFFFFF',
    }),
});

export type TSiteSettingsBannerSchema = z.infer<typeof ZSiteSettingsBannerSchema>;
