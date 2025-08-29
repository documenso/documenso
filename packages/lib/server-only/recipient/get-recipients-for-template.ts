import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

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
      template: {
        team: buildTeamWhereQuery({
          teamId,
          userId,
        }),
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  return recipients;
};
