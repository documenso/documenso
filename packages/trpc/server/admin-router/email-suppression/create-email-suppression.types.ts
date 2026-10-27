import { ZEmailSuppressionTargetSchema } from '@documenso/lib/types/email-suppression';
import { zEmail } from '@documenso/lib/utils/zod';
import { z } from 'zod';

export const ZCreateEmailSuppressionRequestSchema = z.object({
  email: zEmail().trim().toLowerCase().max(254),
  target: ZEmailSuppressionTargetSchema,
  reason: z.string().trim().max(500).optional(),
});

export const ZCreateEmailSuppressionResponseSchema = z.object({
  id: z.string(),
});

export type TCreateEmailSuppressionRequest = z.infer<typeof ZCreateEmailSuppressionRequestSchema>;
