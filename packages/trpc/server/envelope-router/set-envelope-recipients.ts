import { EnvelopeType } from '@prisma/client';
import { match } from 'ts-pattern';

import { setDocumentRecipients } from '@documenso/lib/server-only/recipient/set-document-recipients';
import { setTemplateRecipients } from '@documenso/lib/server-only/recipient/set-template-recipients';

import { authenticatedProcedure } from '../trpc';
import {
  ZSetEnvelopeRecipientsRequestSchema,
  ZSetEnvelopeRecipientsResponseSchema,
} from './set-envelope-recipients.types';

export const setEnvelopeRecipientsRoute = authenticatedProcedure
  .input(ZSetEnvelopeRecipientsRequestSchema)
  .output(ZSetEnvelopeRecipientsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId, envelopeType, recipients } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const { recipients: data } = await match(envelopeType)
      .with(EnvelopeType.DOCUMENT, async () =>
        setDocumentRecipients({
          userId: ctx.user.id,
          teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
          recipients,
          requestMetadata: ctx.metadata,
        }),
      )
      .with(EnvelopeType.TEMPLATE, async () =>
        setTemplateRecipients({
          userId: ctx.user.id,
          teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
          recipients,
        }),
      )
      .exhaustive();

    return {
      data,
    };
  });
