import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../../trpc';
import {
  ZGetEnvelopeRecipientRequestSchema,
  ZGetEnvelopeRecipientResponseSchema,
  getEnvelopeRecipientMeta,
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

    return recipient;
  });
