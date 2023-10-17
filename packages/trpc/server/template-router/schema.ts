import { z } from 'zod';

export const ZCreateTemplateMutationSchema = z.object({
  title: z.string().min(1),
  templateDocumentDataId: z.string().min(1),
});

export type TCreateTemplateMutationSchema = z.infer<typeof ZCreateTemplateMutationSchema>;
