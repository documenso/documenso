import { z } from 'zod';

export const ZCreateOrGetShareLinkMutationSchema = z.object({
  documentId: z.number(),
  token: z.string().optional(),
});

export type TCreateOrGetShareLinkMutationSchema = z.infer<
  typeof ZCreateOrGetShareLinkMutationSchema
>;
