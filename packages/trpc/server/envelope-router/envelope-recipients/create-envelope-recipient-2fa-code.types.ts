import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc';

export const createEnvelopeRecipient2FACodeMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/recipient/{recipientId}/2fa-code',
    summary: 'Create envelope recipient 2FA code',
    description:
      'Creates a 2FA code for a recipient that has the EXTERNAL_TWO_FACTOR_AUTH access auth. ' +
      'Send the code to the recipient through your own channel, such as SMS. ' +
      'The recipient enters the code when they complete the document. The code expires after about 10 minutes.',
    tags: ['Envelope Recipients'],
  },
};

export const ZCreateEnvelopeRecipient2FACodeRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope the recipient belongs to.'),
  recipientId: z.number().describe('The ID of the recipient to create the 2FA code for.'),
});

export const ZCreateEnvelopeRecipient2FACodeResponseSchema = z.object({
  code: z.string().describe('The 6-digit code to send to the recipient.'),
  expiresAt: z.date().describe('The time after which the code is no longer accepted.'),
});

export type TCreateEnvelopeRecipient2FACodeRequest = z.infer<typeof ZCreateEnvelopeRecipient2FACodeRequestSchema>;
export type TCreateEnvelopeRecipient2FACodeResponse = z.infer<typeof ZCreateEnvelopeRecipient2FACodeResponseSchema>;
