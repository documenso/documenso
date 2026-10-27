import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createEmailSuppression } from '@documenso/lib/server-only/email-suppression/create-email-suppression';
import type { TEmailSuppressionTarget } from '@documenso/lib/types/email-suppression';
import { prisma } from '@documenso/prisma';
import { EmailSuppressionScope, EmailSuppressionSource } from '@prisma/client';
import { match } from 'ts-pattern';

import { adminProcedure } from '../../trpc';
import {
  ZCreateEmailSuppressionRequestSchema,
  ZCreateEmailSuppressionResponseSchema,
} from './create-email-suppression.types';

export const createEmailSuppressionRoute = adminProcedure
  .input(ZCreateEmailSuppressionRequestSchema)
  .output(ZCreateEmailSuppressionResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { email, target, reason } = input;

    ctx.logger.info({
      input: {
        target,
      },
    });

    await assertTargetExists(target);

    const suppression = await createEmailSuppression({
      email,
      target,
      reason,
      source: EmailSuppressionSource.ADMIN,
    });

    return {
      id: suppression.id,
    };
  });

const assertTargetExists = async (target: TEmailSuppressionTarget) => {
  if (target.scope === EmailSuppressionScope.GLOBAL) {
    return;
  }

  const count = await match(target)
    .with({ scope: EmailSuppressionScope.ORGANISATION }, async ({ organisationId }) =>
      prisma.organisation.count({ where: { id: organisationId } }),
    )
    .with({ scope: EmailSuppressionScope.TEAM }, async ({ teamId }) => prisma.team.count({ where: { id: teamId } }))
    .with({ scope: EmailSuppressionScope.USER }, async ({ userId }) => prisma.user.count({ where: { id: userId } }))
    .exhaustive();

  if (count === 0) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `No ${target.scope.toLowerCase()} exists with this ID`,
    });
  }
};
