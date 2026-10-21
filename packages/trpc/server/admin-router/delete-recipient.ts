import { adminDeleteRecipient } from '@documenso/lib/server-only/admin/admin-delete-recipient';

import { adminProcedure } from '../trpc';
import { ZDeleteRecipientRequestSchema, ZDeleteRecipientResponseSchema } from './delete-recipient.types';

export const deleteRecipientRoute = adminProcedure
  .input(ZDeleteRecipientRequestSchema)
  .output(ZDeleteRecipientResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id, reason } = input;

    ctx.logger.info({ input: { id } });

    await adminDeleteRecipient({
      recipientId: id,
      reason,
      requestMetadata: ctx.metadata,
    });
  });
