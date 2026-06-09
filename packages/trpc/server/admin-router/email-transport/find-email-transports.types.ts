import { ZEmailTransportPublicConfigSchema } from '@documenso/lib/server-only/email/email-transport-config';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import EmailTransportSchema from '@documenso/prisma/generated/zod/modelSchema/EmailTransportSchema';
import { z } from 'zod';

export const ZFindEmailTransportsRequestSchema = ZFindSearchParamsSchema;

export const ZFindEmailTransportsResponseSchema = ZFindResultResponse.extend({
  data: EmailTransportSchema.pick({
    id: true,
    name: true,
    type: true,
    fromName: true,
    fromAddress: true,
    createdAt: true,
    updatedAt: true,
  })
    .extend({
      _count: z.object({
        subscriptionClaims: z.number(),
        organisationClaims: z.number(),
      }),
      // Non-secret connection settings, so the edit form can pre-fill them.
      // Null when the stored config can't be decrypted/parsed.
      config: ZEmailTransportPublicConfigSchema.nullable(),
    })
    .array(),
});

export type TFindEmailTransportsRequest = z.infer<typeof ZFindEmailTransportsRequestSchema>;
export type TFindEmailTransportsResponse = z.infer<typeof ZFindEmailTransportsResponseSchema>;
