import { scheduleDocument } from '@documenso/lib/server-only/document/schedule-document';

import { authenticatedProcedure } from '../trpc';
import {
  ZCancelScheduledSendRequestSchema,
  ZCancelScheduledSendResponseSchema,
  cancelScheduledSendMeta,
} from './cancel-scheduled-send.types';

export const cancelScheduledSendRoute = authenticatedProcedure
  .meta(cancelScheduledSendMeta)
  .input(ZCancelScheduledSendRequestSchema)
  .output(ZCancelScheduledSendResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    await scheduleDocument({
      userId: ctx.user.id,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      teamId,
      scheduledAt: null,
    });

    return {
      success: true,
    };
  });
