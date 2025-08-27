import { z } from 'zod';

import { ZSiteSettingSchema } from '@documenso/lib/server-only/site-settings/schema';

export const ZUpdateSiteSettingRequestSchema = ZSiteSettingSchema;

export const ZUpdateSiteSettingResponseSchema = z.void();

export type TUpdateSiteSettingRequest = z.infer<typeof ZUpdateSiteSettingRequestSchema>;
export type TUpdateSiteSettingResponse = z.infer<typeof ZUpdateSiteSettingResponseSchema>;
