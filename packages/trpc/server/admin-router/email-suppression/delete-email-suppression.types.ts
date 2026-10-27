import { z } from 'zod';

export const ZDeleteEmailSuppressionRequestSchema = z.object({
  id: z.string(),
});

export const ZDeleteEmailSuppressionResponseSchema = z.void();

export type TDeleteEmailSuppressionRequest = z.infer<typeof ZDeleteEmailSuppressionRequestSchema>;
