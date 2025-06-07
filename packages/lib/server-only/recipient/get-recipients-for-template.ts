import { prisma } from '@documenso/prisma';

export interface GetRecipientsForTemplateOptions {
  templateId: number;
  userId: number;
  teamId: number;
}

export const getRecipientsForTemplate = async ({
  templateId,
  userId,
  teamId,
}: GetRecipientsForTemplateOptions) => {
  const recipients = await prisma.recipient.findMany({
    where: {
      templateId,
      template: teamId
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
          },
    },
    orderBy: {
      id: 'asc',
    },
  });

  return recipients;
};
