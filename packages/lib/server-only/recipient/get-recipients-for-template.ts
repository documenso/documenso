import { prisma } from '@documenso/prisma';

export interface GetRecipientsForTemplateOptions {
  templateId: number;
  userId: number;
}

export const getRecipientsForTemplate = async ({
  templateId,
  userId,
}: GetRecipientsForTemplateOptions) => {
  const recipients = await prisma.recipient.findMany({
    where: {
      templateId,
      Template: {
        OR: [
          {
            userId,
          },
          {
            team: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
        ],
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  return recipients;
};
