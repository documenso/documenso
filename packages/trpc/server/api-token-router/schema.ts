import { z } from 'zod';

export const ZGetApiTokenByIdQuerySchema = z.object({
  id: z.number().min(1),
});

export const ZCreateTokenMutationSchema = z.object({
  tokenName: z.string().min(3, { message: 'The token name should be 3 characters or longer' }),
});

export const ZDeleteTokenByIdMutationSchema = z.object({
  id: z.number().min(1),
});
