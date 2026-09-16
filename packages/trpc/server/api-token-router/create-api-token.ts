import { captureServerEvent } from '@documenso/lib/server-only/analytics/capture-server-event';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { fireAndForget } from '@documenso/lib/universal/fire-and-forget';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { ZCreateApiTokenRequestSchema, ZCreateApiTokenResponseSchema } from './create-api-token.types';

export const createApiTokenRoute = authenticatedProcedure
  .input(ZCreateApiTokenRequestSchema)
  .output(ZCreateApiTokenResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { tokenName, teamId, expirationDate } = input;

    ctx.logger.info({
      input: {
        teamId,
      },
    });

    const createdToken = await createApiToken({
      userId: ctx.user.id,
      teamId,
      tokenName,
      expiresIn: expirationDate,
    });

    fireAndForget(async () => {
      const team = await prisma.team.findFirst({
        where: { id: teamId },
        select: { organisationId: true },
      });

      captureServerEvent({
        event: 'App: API Token Created',
        userId: ctx.user.id,
        teamId,
        organisationId: team?.organisationId,
      });
    });

    return createdToken;
  });
