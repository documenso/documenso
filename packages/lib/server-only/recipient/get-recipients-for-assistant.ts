import { FieldType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export interface GetRecipientsForAssistantOptions {
  token: string;
}

export const getRecipientsForAssistant = async ({ token }: GetRecipientsForAssistantOptions) => {
  const assistant = await prisma.recipient.findFirst({
    where: {
      token,
    },
  });

  if (!assistant) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Assistant not found',
    });
  }

  let recipients = await prisma.recipient.findMany({
    where: {
      documentId: assistant.documentId,
      signingOrder: {
        gte: assistant.signingOrder ?? 0,
      },
    },
    include: {
      fields: {
        where: {
          OR: [
            {
              recipientId: assistant.id,
            },
            {
              type: {
                not: FieldType.SIGNATURE,
              },
              documentId: assistant.documentId,
            },
          ],
        },
      },
    },
  });

  // Omit the token for recipients other than the assistant so
  // it doesn't get sent to the client.
  recipients = recipients.map((recipient) => ({
    ...recipient,
    token: recipient.id === assistant.id ? token : '',
  }));

  return recipients;
};
