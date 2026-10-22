import { z } from 'zod';

import { ZSiteSettingsBannerSchema } from './schemas/banner';
import { ZSiteSettingsEmailBlocklistSchema } from './schemas/email-blocklist';
import { ZSiteSettingsTelemetrySchema } from './schemas/telemetry';
import { ZSiteSettingsTwoFactorEnforcementSchema } from './schemas/two-factor-enforcement';

export const ZSiteSettingSchema = z.union([
  ZSiteSettingsBannerSchema,
  ZSiteSettingsEmailBlocklistSchema,
  ZSiteSettingsTelemetrySchema,
  ZSiteSettingsTwoFactorEnforcementSchema,
]);

export type TSiteSettingSchema = z.infer<typeof ZSiteSettingSchema>;

export const ZSiteSettingsSchema = z.array(ZSiteSettingSchema);

export type TSiteSettingsSchema = z.infer<typeof ZSiteSettingsSchema>;
