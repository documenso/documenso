import { ZSiteSettingsBannerSchema } from '@documenso/lib/server-only/site-settings/schemas/banner';
import { ZSiteSettingsEmailBlocklistSchema } from '@documenso/lib/server-only/site-settings/schemas/email-blocklist';
import { ZSiteSettingsTelemetrySchema } from '@documenso/lib/server-only/site-settings/schemas/telemetry';
import { z } from 'zod';

/**
 * Deliberately excludes `ZSiteSettingsTwoFactorEnforcementSchema`, which is only
 * writable via its dedicated admin procedure (license assert, enable-time guard
 * and grace-reduction acknowledgement).
 */
export const ZUpdateSiteSettingRequestSchema = z.union([
  ZSiteSettingsBannerSchema,
  ZSiteSettingsEmailBlocklistSchema,
  ZSiteSettingsTelemetrySchema,
]);

export const ZUpdateSiteSettingResponseSchema = z.void();

export type TUpdateSiteSettingRequest = z.infer<typeof ZUpdateSiteSettingRequestSchema>;
export type TUpdateSiteSettingResponse = z.infer<typeof ZUpdateSiteSettingResponseSchema>;
