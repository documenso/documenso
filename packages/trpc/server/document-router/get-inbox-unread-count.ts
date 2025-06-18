import { DocumentStatus, ReadStatus, RecipientRole } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';

export const ZGetInboxUnreadCountResponseSchema = z.object({
  count: z.number(),
});

export type TGetInboxUnreadCountResponse = z.infer<typeof ZGetInboxUnreadCountResponseSchema>;

export const getInboxUnreadCountRoute = authenticatedProcedure
  .output(ZGetInboxUnreadCountResponseSchema)
  .query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const user = await prisma.user.findFirstOrThrow({
      where: {
        id: userId,
      },
    });

    const count = await prisma.recipient.count({
      where: {
        email: user.email,
        readStatus: ReadStatus.NOT_OPENED,
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
