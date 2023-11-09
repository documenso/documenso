import { z } from 'zod';

export const ZSignFieldWithTokenMutationSchema = z.object({
  token: z.string(),
  fieldId: z.number(),
  value: z.string().trim(),
  isBase64: z.boolean().optional(),
});

export type TSignFieldWithTokenMutationSchema = z.infer<typeof ZSignFieldWithTokenMutationSchema>;

export const ZRemovedSignedFieldWithTokenMutationSchema = z.object({
  token: z.string(),
  fieldId: z.number(),
});

export type TRemovedSignedFieldWithTokenMutationSchema = z.infer<
  typeof ZRemovedSignedFieldWithTokenMutationSchema
>;
