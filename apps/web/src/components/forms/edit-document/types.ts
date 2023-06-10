import { z } from 'zod';

export const ZEditDocumentFormSchema = z.object({
  signers: z.array(
    z.object({
      id: z.number().optional(),
      email: z.string().min(1).email(),
      name: z.string(),
    }),
  ),
});

export type TEditDocumentFormSchema = z.infer<typeof ZEditDocumentFormSchema>;
