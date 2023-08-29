import { z } from 'zod';

export const ZShareLinkSchema = z.object({
  documentId: z.number(),
  recipientId: z.number(),
});

export type ZShareLinkSchema = z.infer<typeof ZShareLinkSchema>;
