import { z } from 'zod';

export const ZEncryptDataMutationSchema = z.object({
  data: z.string(),
  expiresAt: z.number().optional(),
});

export const ZDecryptDataMutationSchema = z.object({
  data: z.string(),
});

export type TEncryptDataMutationSchema = z.infer<typeof ZEncryptDataMutationSchema>;
export type TDecryptDataMutationSchema = z.infer<typeof ZDecryptDataMutationSchema>;
