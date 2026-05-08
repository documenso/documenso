import { ZSiteSettingSchema } from '@documenso/lib/server-only/site-settings/schema';
import { z } from 'zod';

export const ZUpdateSiteSettingRequestSchema = ZSiteSettingSchema;

export const ZUpdateSiteSettingResponseSchema = z.void();

export type TUpdateSiteSettingRequest = z.infer<typeof ZUpdateSiteSettingRequestSchema>;
export type TUpdateSiteSettingResponse = z.infer<typeof ZUpdateSiteSettingResponseSchema>;
