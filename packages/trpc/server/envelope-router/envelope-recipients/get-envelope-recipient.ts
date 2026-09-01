import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../../trpc';
import {
  getEnvelopeRecipientMeta,
  ZGetEnvelopeRecipientRequestSchema,
  ZGetEnvelopeRecipientResponseSchema,
} from './get-envelope-recipient.types';

export const getEnvelopeRecipientRoute = authenticatedProcedure
  .meta(getEnvelopeRecipientMeta)
  .input(ZGetEnvelopeRecipientRequestSchema)
  .output(ZGetEnvelopeRecipientResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { recipientId } = input;

    ctx.logger.info({
      input: {
        recipientId,
      },
    });

    const recipient = await prisma.recipient.findFirst({
      where: {
        id: recipientId,
        envelope: {
          team: buildTeamWhereQuery({ teamId, userId: user.id }),
        },
      },
      include: {
        fields: true,
      },
    });

    if (!recipient) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Recipient not found',
      });
    }

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'envelopeId',
        id: recipient.envelopeId,
      },
      type: null,
      userId: user.id,
      teamId,
    });

    // Additional validation to check visibility.
    const envelope = await prisma.envelope.findUnique({
      where: envelopeWhereInput,
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Recipient not found',
      });
    }

    return recipient;
  });
