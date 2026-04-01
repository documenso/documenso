import { z } from 'zod';

import { ZSiteSettingsBaseSchema } from './_base';

export const SITE_SETTINGS_TELEMETRY_ID = 'telemetry.installation';

export const ZSiteSettingsTelemetrySchema = ZSiteSettingsBaseSchema.extend({
  id: z.literal(SITE_SETTINGS_TELEMETRY_ID),
  data: z.object({
    installationId: z.string(),
  }),
});

export type TSiteSettingsTelemetrySchema = z.infer<typeof ZSiteSettingsTelemetrySchema>;
