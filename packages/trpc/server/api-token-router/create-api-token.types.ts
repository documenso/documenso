import { z } from 'zod';

export const ZCreateApiTokenRequestSchema = z.object({
  teamId: z.number(),
  tokenName: z.string().min(3, { message: 'The token name should be 3 characters or longer' }),
  expirationDate: z.string().nullable(),
});

export const ZCreateApiTokenResponseSchema = z.object({
  id: z.number(),
  token: z.string(),
});
