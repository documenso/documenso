import { z } from 'zod';

export const ZSendMailMutationSchema = z.object({
  email: z.string().min(1).email(),
  name: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  documentSigningLink: z.string().min(1).optional(),
  documentName: z.string().min(1).optional(),
  downloadLink: z.string().min(1).optional(),
  reviewLink: z.string().min(1).optional(),
  numberOfSigners: z.number().int().min(1).optional(),
  type: z.enum(['invite', 'signed', 'completed']),
});

export type TSendMailMutationSchema = z.infer<typeof ZSendMailMutationSchema>;
