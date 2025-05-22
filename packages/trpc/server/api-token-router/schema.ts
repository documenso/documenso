import { z } from 'zod';

export const ZGetApiTokenByIdQuerySchema = z.object({
  id: z.number().min(1),
});

export type TGetApiTokenByIdQuerySchema = z.infer<typeof ZGetApiTokenByIdQuerySchema>;

export const ZCreateTokenMutationSchema = z.object({
  teamId: z.number(),
  tokenName: z.string().min(3, { message: 'The token name should be 3 characters or longer' }),
  expirationDate: z.string().nullable(),
});

export type TCreateTokenMutationSchema = z.infer<typeof ZCreateTokenMutationSchema>;

export const ZDeleteTokenByIdMutationSchema = z.object({
  id: z.number().min(1),
  teamId: z.number(),
});

export type TDeleteTokenByIdMutationSchema = z.infer<typeof ZDeleteTokenByIdMutationSchema>;
