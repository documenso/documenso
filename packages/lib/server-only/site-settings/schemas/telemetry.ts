import { nanoid } from 'nanoid';
import { z } from 'zod';

import { ZSiteSettingsBaseSchema } from './_base';

export const SITE_SETTINGS_TELEMETRY_ID = 'site.instance-id';

export const ZSiteSettingsTelemetrySchema = ZSiteSettingsBaseSchema.extend({
  id: z.literal(SITE_SETTINGS_TELEMETRY_ID),
  data: z
    .object({
      instanceId: z.string(),
    })
    .optional()
    .default({
      instanceId: nanoid(),
    }),
});

export type TSiteSettingsTelemetrySchema = z.infer<typeof ZSiteSettingsTelemetrySchema>;
