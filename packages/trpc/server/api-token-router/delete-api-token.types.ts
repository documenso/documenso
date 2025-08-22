import { z } from 'zod';

export const ZDeleteApiTokenRequestSchema = z.object({
  id: z.number().min(1),
  teamId: z.number(),
});

export const ZDeleteApiTokenResponseSchema = z.void();
