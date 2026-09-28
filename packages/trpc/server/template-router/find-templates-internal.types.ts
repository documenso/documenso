import { z } from 'zod';

import { ZFindTemplatesRequestSchema, ZFindTemplatesResponseSchema } from './schema';

export const ZFindTemplatesInternalRequestSchema = ZFindTemplatesRequestSchema.extend({
  ownerIds: z.array(z.number()).optional(),
});

export const ZFindTemplatesInternalResponseSchema = ZFindTemplatesResponseSchema;

export type TFindTemplatesInternalRequest = z.infer<typeof ZFindTemplatesInternalRequestSchema>;
export type TFindTemplatesInternalResponse = z.infer<typeof ZFindTemplatesInternalResponseSchema>;
