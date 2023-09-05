import { z } from 'zod';

export const ZShareLinkCreateSchema = z.object({
  documentId: z.number(),
  recipientId: z.number(),
});

export const ZShareLinkGetSchema = z.object({
  shareId: z.string(),
});

export type ZShareLinkCreateSchema = z.infer<typeof ZShareLinkCreateSchema>;
export type ZShareLinkGetSchema = z.infer<typeof ZShareLinkGetSchema>;
