import { z } from 'zod';

export const ZSendMailMutationSchema = z.object({
  email: z.string().min(1).email(),
});

export type TSendMailMutationSchema = z.infer<typeof ZSendMailMutationSchema>;
