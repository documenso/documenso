import { updateRecipient } from '@documenso/lib/server-only/admin/update-recipient';

import { adminProcedure } from '../trpc';
import {
  ZUpdateRecipientRequestSchema,
  ZUpdateRecipientResponseSchema,
} from './update-recipient.types';

export const updateRecipientRoute = adminProcedure
  .input(ZUpdateRecipientRequestSchema)
  .output(ZUpdateRecipientResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id, name, email } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    await updateRecipient({ id, name, email });
  });
