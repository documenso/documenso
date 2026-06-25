import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { rejectDocumentOnBehalfOf } from '@documenso/lib/server-only/document/reject-document-on-behalf-of';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';

import { authenticatedProcedure } from '../../trpc';
import {
  rejectEnvelopeRecipientOnBehalfOfMeta,
  ZRejectEnvelopeRecipientOnBehalfOfRequestSchema,
  ZRejectEnvelopeRecipientOnBehalfOfResponseSchema,
} from './reject-envelope-recipient-on-behalf-of.types';

export const rejectEnvelopeRecipientOnBehalfOfRoute = authenticatedProcedure
  .meta(rejectEnvelopeRecipientOnBehalfOfMeta)
  .input(ZRejectEnvelopeRecipientOnBehalfOfRequestSchema)
  .output(ZRejectEnvelopeRecipientOnBehalfOfResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { envelopeId, recipientId, reason, actAsEmail } = input;

    ctx.logger.info({
      input: {
        envelopeId,
        recipientId,
      },
    });

    // This is an external-only action: it must only be reachable through the
    // public API, never the internal app TRPC handler.
    if (ctx.metadata.source !== 'apiV2') {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'This route is only accessible via the public API',
      });
    }

    await rejectDocumentOnBehalfOf({
      envelopeId,
      recipientId,
      userId: user.id,
      teamId,
      reason,
      actAsEmail,
      requestMetadata: ctx.metadata,
    });

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: { type: 'envelopeId', id: envelopeId },
      type: EnvelopeType.DOCUMENT,
      userId: user.id,
      teamId,
    });

    const recipient = await prisma.recipient.findFirstOrThrow({
      where: {
        id: recipientId,
        envelope: envelopeWhereInput,
      },
      include: {
        fields: true,
      },
    });

    return recipient;
  });
