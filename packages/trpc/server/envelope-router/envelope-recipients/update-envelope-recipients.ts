import { updateEnvelopeRecipients } from '@documenso/lib/server-only/recipient/update-envelope-recipients';

import { authenticatedProcedure } from '../../trpc';
import { twoFactorScope } from '../../two-factor-enforcement/enforce';
import {
  updateEnvelopeRecipientsMeta,
  ZUpdateEnvelopeRecipientsRequestSchema,
  ZUpdateEnvelopeRecipientsResponseSchema,
} from './update-envelope-recipients.types';

export const updateEnvelopeRecipientsRoute = authenticatedProcedure
  .meta(updateEnvelopeRecipientsMeta)
  .input(ZUpdateEnvelopeRecipientsRequestSchema)
  .output(ZUpdateEnvelopeRecipientsResponseSchema)
  .use(twoFactorScope((input) => ({ envelope: input.envelopeId })))
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;
    const { envelopeId, data: recipients } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const { recipients: data } = await updateEnvelopeRecipients({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      recipients,
      requestMetadata: ctx.metadata,
    });

    return {
      data,
    };
  });
