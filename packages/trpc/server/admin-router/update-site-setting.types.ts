import { ZSiteSettingsBannerSchema } from '@documenso/lib/server-only/site-settings/schemas/banner';
import { ZSiteSettingsEmailBlocklistSchema } from '@documenso/lib/server-only/site-settings/schemas/email-blocklist';
import { ZSiteSettingsTelemetrySchema } from '@documenso/lib/server-only/site-settings/schemas/telemetry';
import { z } from 'zod';

/**
 * Write union for the generic site-setting update route. Deliberately
 * EXCLUDES `ZSiteSettingsTwoFactorEnforcementSchema` (which remains in the
 * read union): the 2FA enforcement setting is only writable via its dedicated
 * admin procedure, which carries the license assert, the enable-time guard
 * and the grace-reduction acknowledgement.
 */
export const ZUpdateSiteSettingRequestSchema = z.union([
  ZSiteSettingsBannerSchema,
  ZSiteSettingsEmailBlocklistSchema,
  ZSiteSettingsTelemetrySchema,
]);

export const ZUpdateSiteSettingResponseSchema = z.void();

export type TUpdateSiteSettingRequest = z.infer<typeof ZUpdateSiteSettingRequestSchema>;
export type TUpdateSiteSettingResponse = z.infer<typeof ZUpdateSiteSettingResponseSchema>;
