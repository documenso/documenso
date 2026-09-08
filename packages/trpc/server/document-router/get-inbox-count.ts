import { prisma } from '@documenso/prisma';
import { DocumentStatus, EnvelopeType, RecipientRole } from '@prisma/client';

import { authenticatedProcedure } from '../trpc';
import { twoFactorInstanceOnly } from '../two-factor-enforcement/enforce';
import { ZGetInboxCountRequestSchema, ZGetInboxCountResponseSchema } from './get-inbox-count.types';

export const getInboxCountRoute = authenticatedProcedure
  .input(ZGetInboxCountRequestSchema)
  .output(ZGetInboxCountResponseSchema)
  // 2FA enforcement: recipient-perspective inbox count; see find-inbox. Instance assert still applies.
  .use(twoFactorInstanceOnly())
  .query(async ({ input, ctx }) => {
    const { readStatus } = input ?? {};

    const userEmail = ctx.user.email;

    const count = await prisma.recipient.count({
      where: {
        email: userEmail,
        readStatus,
        role: {
          not: RecipientRole.CC,
        },
        envelope: {
          type: EnvelopeType.DOCUMENT,
          status: {
            notIn: [DocumentStatus.DRAFT, DocumentStatus.REJECTED],
          },
          deletedAt: null,
        },
      },
    });

    return {
      count,
    };
  });
