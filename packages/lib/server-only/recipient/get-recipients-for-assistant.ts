import { prisma } from '@documenso/prisma';
import { FieldType } from '@prisma/client';

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
      envelopeId: assistant.envelopeId,
      OR: [
        // The assistant themself — they may have fields of their own.
        { id: assistant.id },
        // Grouped assistants only assist strictly later steps, never their
        // own group peers.
        { signingOrder: { gt: assistant.signingOrder ?? 0 } },
      ],
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
              envelopeId: assistant.envelopeId,
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
