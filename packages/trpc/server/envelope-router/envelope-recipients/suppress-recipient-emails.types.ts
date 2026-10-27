import EmailSuppressionScopeSchema from '@documenso/prisma/generated/zod/inputTypeSchemas/EmailSuppressionScopeSchema';
import { z } from 'zod';

export const ZSuppressRecipientEmailsRequestSchema = z.object({
  token: z.string().min(1).describe('The recipient token from the email link.'),
  scope: EmailSuppressionScopeSchema.describe(
    'Which emails to stop: from the document owner, the team, the organisation, or all senders.',
  ),
});

export const ZSuppressRecipientEmailsResponseSchema = z.void();

export type TSuppressRecipientEmailsRequest = z.infer<typeof ZSuppressRecipientEmailsRequestSchema>;
