import { ZNameSchema } from '@documenso/lib/types/name';
import { z } from 'zod';

export const ZCreateApiTokenRequestSchema = z.object({
  teamId: z.number(),
  tokenName: ZNameSchema,
  expirationDate: z.string().nullable(),
});

export const ZCreateApiTokenResponseSchema = z.object({
  id: z.number(),
  token: z.string(),
});
