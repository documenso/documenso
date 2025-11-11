import { createEnvelopeRecipients } from '@documenso/lib/server-only/recipient/create-envelope-recipients';

import { authenticatedProcedure } from '../../trpc';
import {
  ZCreateEnvelopeRecipientsRequestSchema,
  ZCreateEnvelopeRecipientsResponseSchema,
  createEnvelopeRecipientsMeta,
} from './create-envelope-recipients.types';

export const createEnvelopeRecipientsRoute = authenticatedProcedure
  .meta(createEnvelopeRecipientsMeta)
  .input(ZCreateEnvelopeRecipientsRequestSchema)
  .output(ZCreateEnvelopeRecipientsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId, metadata } = ctx;
    const { envelopeId, data: recipients } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const { recipients: data } = await createEnvelopeRecipients({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      recipients,
      requestMetadata: metadata,
    });

    return {
      data,
    };
  });
