import { z } from 'zod';

export const ZSiteSettingsBaseSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  data: z.never(),
});

export type TSiteSettingsBaseSchema = z.infer<typeof ZSiteSettingsBaseSchema>;
