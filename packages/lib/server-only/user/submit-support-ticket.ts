import { plainClient } from '@documenso/lib/plain/client';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildOrganisationWhereQuery } from '../../utils/organisations';
import { getTeamById } from '../team/get-team';

type SubmitSupportTicketOptions = {
  subject: string;
  message: string;
  userId: number;
  organisationId: string;
  teamId?: number | null;
};

export const submitSupportTicket = async ({
  subject,
  message,
  userId,
  organisationId,
  teamId,
}: SubmitSupportTicketOptions) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User not found',
    });
  }

  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
    }),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  const team = teamId
    ? await getTeamById({
        userId,
        teamId,
      })
    : null;

  const customMessage = `
Organisation: ${organisation.name} (${organisation.id})
Team: ${team ? `${team.name} (${team.id})` : 'No team provided'}

${message}`;

  const res = await plainClient.createThread({
    title: subject,
    customerIdentifier: { emailAddress: user.email },
    components: [{ componentText: { text: customMessage } }],
  });

  if (res.error) {
    throw new Error(res.error.message);
  }

  return res;
};
