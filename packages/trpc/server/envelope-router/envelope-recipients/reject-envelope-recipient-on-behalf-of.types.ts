import { ZEnvelopeRecipientSchema } from '@documenso/lib/types/recipient';
import { zEmail } from '@documenso/lib/utils/zod';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc';

export const rejectEnvelopeRecipientOnBehalfOfMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/recipient/{recipientId}/reject',
    summary: 'Reject envelope recipient on behalf of',
    description:
      'Records a rejection on behalf of a recipient. Use this when a recipient has declined to ' +
      'sign outside of the platform. The rejection is flagged as external in the document audit ' +
      'log. By default the action is attributed to the API user; supply `actAsEmail` to attribute ' +
      'it to a specific team member.',
    tags: ['Envelope Recipients'],
  },
};

export const ZRejectEnvelopeRecipientOnBehalfOfRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope the recipient belongs to.'),
  recipientId: z.number().describe('The ID of the recipient to reject the document on behalf of.'),
  reason: z.string().min(1).describe('The reason the recipient rejected the document.'),
  actAsEmail: zEmail()
    .optional()
    .describe('The email of the team member to attribute the rejection to. Defaults to the API user when omitted.'),
});

export const ZRejectEnvelopeRecipientOnBehalfOfResponseSchema = ZEnvelopeRecipientSchema;

export type TRejectEnvelopeRecipientOnBehalfOfRequest = z.infer<typeof ZRejectEnvelopeRecipientOnBehalfOfRequestSchema>;
export type TRejectEnvelopeRecipientOnBehalfOfResponse = z.infer<
  typeof ZRejectEnvelopeRecipientOnBehalfOfResponseSchema
>;
