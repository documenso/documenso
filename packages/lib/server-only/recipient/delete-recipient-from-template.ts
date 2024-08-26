import { prisma } from '@documenso/prisma';
import { SendStatus } from '@documenso/prisma/client';

export type DeleteRecipientForTemplateOptions = {
  templateId: number;
  recipientId: number;
  userId: number;
  teamId?: number;
};

export const deleteRecipientFromTemplate = async ({
  templateId,
  recipientId,
  userId,
  teamId,
}: DeleteRecipientForTemplateOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
      Template: {
        id: templateId,
        ...(teamId
          ? {
              team: {
                id: teamId,
                members: {
                  some: {
                    userId,
                  },
                },
              },
            }
          : {
              userId,
              teamId: null,
            }),
      },
    },
  });

  console.log('deleteRecipientFromTemplate function pure', recipient);

  console.log('deleteRecipientFromTemplate function pure', {
    templateId,
    recipientId,
    userId,
    teamId,
  });

  if (!recipient) {
    throw new Error('Recipient not found');
  }

  if (recipient.sendStatus !== SendStatus.NOT_SENT) {
    throw new Error('Can not delete a recipient that has already been sent a document');
  }

  return await prisma.recipient.delete({
    where: {
      id: recipient.id,
    },
  });
};
