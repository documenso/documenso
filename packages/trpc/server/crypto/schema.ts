import { z } from 'zod';

export const ZEncryptSecondaryDataMutationSchema = z.object({
  data: z.string(),
  expiresAt: z.number().optional(),
});

export const ZDecryptDataMutationSchema = z.object({
  data: z.string(),
});

export type TEncryptSecondaryDataMutationSchema = z.infer<
  typeof ZEncryptSecondaryDataMutationSchema
>;
export type TDecryptDataMutationSchema = z.infer<typeof ZDecryptDataMutationSchema>;
