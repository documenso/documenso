import { z } from 'zod';

import { zEmail } from '@documenso/lib/utils/zod';

export const ZUpdateRecipientRequestSchema = z.object({
  id: z.number().min(1),
  name: z.string().optional(),
  email: zEmail().optional(),
  role: z.enum(['CC', 'SIGNER', 'VIEWER', 'APPROVER', 'ASSISTANT']).optional(),
});

export const ZUpdateRecipientResponseSchema = z.void();

export type TUpdateRecipientRequest = z.infer<typeof ZUpdateRecipientRequestSchema>;
export type TUpdateRecipientResponse = z.infer<typeof ZUpdateRecipientResponseSchema>;
