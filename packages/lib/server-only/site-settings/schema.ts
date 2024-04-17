import { z } from 'zod';

import { ZSiteSettingsBannerSchema } from './schemas/banner';

// TODO: Use `z.union([...])` once we have more than one setting
export const ZSiteSettingSchema = ZSiteSettingsBannerSchema;

export type TSiteSettingSchema = z.infer<typeof ZSiteSettingSchema>;

export const ZSiteSettingsSchema = z.array(ZSiteSettingSchema);

export type TSiteSettingsSchema = z.infer<typeof ZSiteSettingsSchema>;
