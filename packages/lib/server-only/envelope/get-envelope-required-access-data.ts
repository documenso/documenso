import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export const getEnvelopeRequiredAccessData = async ({ token }: { token: string }) => {
  const envelope = await prisma.envelope.findFirst({
    where: {
      type: EnvelopeType.DOCUMENT,
      status: {
        not: DocumentStatus.DRAFT,
      },
      recipients: {
        some: {
          token,
        },
      },
    },
    include: {
      recipients: {
        where: {
          token,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  const recipient = envelope.recipients.find((r) => r.token === token);

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
    });
  }

  const recipientUserAccount = await prisma.user.findFirst({
    where: {
      email: recipient.email.toLowerCase(),
    },
    select: {
      id: true,
    },
  });

  return {
    recipientEmail: recipient.email,
    recipientHasAccount: Boolean(recipientUserAccount),
  } as const;
};
