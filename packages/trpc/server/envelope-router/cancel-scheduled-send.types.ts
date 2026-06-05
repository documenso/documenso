import { z } from 'zod';

import { ZSuccessResponseSchema } from '../schema';
import type { TrpcRouteMeta } from '../trpc';

export const cancelScheduledSendMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/cancel-scheduled-send',
    summary: 'Cancel scheduled send',
    description: 'Cancel a pending scheduled send and revert the envelope to a normal draft.',
    tags: ['Envelope'],
  },
};

export const ZCancelScheduledSendRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope whose scheduled send should be cancelled.'),
});

export const ZCancelScheduledSendResponseSchema = ZSuccessResponseSchema;

export type TCancelScheduledSendRequest = z.infer<typeof ZCancelScheduledSendRequestSchema>;
export type TCancelScheduledSendResponse = z.infer<typeof ZCancelScheduledSendResponseSchema>;
