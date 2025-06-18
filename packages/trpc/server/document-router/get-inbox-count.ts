import { DocumentStatus, RecipientRole } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { ZGetInboxCountRequestSchema, ZGetInboxCountResponseSchema } from './get-inbox-count.types';

export const getInboxCountRoute = authenticatedProcedure
  .input(ZGetInboxCountRequestSchema)
  .output(ZGetInboxCountResponseSchema)
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
        document: {
          status: {
            not: DocumentStatus.DRAFT,
          },
          deletedAt: null,
        },
      },
    });

    return {
      count,
    };
  });
