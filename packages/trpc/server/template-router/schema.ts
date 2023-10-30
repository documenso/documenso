import { z } from 'zod';

export const ZCreateTemplateMutationSchema = z.object({
  title: z.string().min(1),
  templateDocumentDataId: z.string().min(1),
});

export const ZCreateDocumentFromTemplateMutationSchema = z.object({
  templateId: z.number(),
});

export const ZDuplicateTemplateMutationSchema = z.object({
  templateId: z.number(),
});

export type TCreateTemplateMutationSchema = z.infer<typeof ZCreateTemplateMutationSchema>;
export type TCreateDocumentFromTemplateMutationSchema = z.infer<
  typeof ZCreateDocumentFromTemplateMutationSchema
>;
export type TDuplicateTemplateMutationSchema = z.infer<typeof ZDuplicateTemplateMutationSchema>;
