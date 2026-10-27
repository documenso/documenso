import { prisma } from '@documenso/prisma';
import type { EmailSuppressionSource } from '@prisma/client';
import { EmailSuppressionScope } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TEmailSuppressionTarget } from '../../types/email-suppression';
import { generateDatabaseId } from '../../universal/id';

export type CreateEmailSuppressionOptions = {
  email: string;
  target: TEmailSuppressionTarget;
  source: EmailSuppressionSource;
  reason?: string;
};

export const createEmailSuppression = async ({ email, target, source, reason }: CreateEmailSuppressionOptions) => {
  const suppression = {
    email: email.trim().toLowerCase(),
    scope: target.scope,
    organisationId: target.scope === EmailSuppressionScope.ORGANISATION ? target.organisationId : null,
    teamId: target.scope === EmailSuppressionScope.TEAM ? target.teamId : null,
    userId: target.scope === EmailSuppressionScope.USER ? target.userId : null,
  };

  // Checked here rather than with a unique constraint, since Postgres treats the null
  // sender columns as distinct.
  const existingSuppression = await prisma.emailSuppression.findFirst({
    where: suppression,
    select: {
      id: true,
    },
  });

  if (existingSuppression) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS, {
      message: 'This email is already suppressed for this sender',
    });
  }

  return await prisma.emailSuppression.create({
    data: {
      id: generateDatabaseId('email_suppression'),
      ...suppression,
      source,
      reason,
    },
  });
};
