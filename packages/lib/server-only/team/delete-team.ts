import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import type { TeamDeleteEmailProps } from '@documenso/email/templates/team-delete';
import { TeamDeleteEmailTemplate } from '@documenso/email/templates/team-delete';
import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { AppError } from '@documenso/lib/errors/app-error';
import { stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';
import { TeamMemberRole } from '@documenso/prisma/client';

export type DeleteTeamOptions = {
  userId: number;
  teamId: number;
};

export const deleteTeam = async ({ userId, teamId }: DeleteTeamOptions) => {
  await prisma.$transaction(
    async (tx) => {
      const team = await tx.team.findFirstOrThrow({
        where: {
          id: teamId,
          ownerUserId: userId,
        },
        include: {
          subscription: true,
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (team.subscription) {
        await stripe.subscriptions
          .cancel(team.subscription.planId, {
            prorate: false,
            invoice_now: true,
          })
          .catch((err) => {
            console.error(err);
            throw AppError.parseError(err);
          });
      }

      const teamOwners = team.members.filter((member) => member.role === TeamMemberRole.ADMIN);
      const teamMembers = team.members.filter(
        (member) => member.role === TeamMemberRole.MANAGER || member.role === TeamMemberRole.MEMBER,
      );

      const ownerSendEmailResults = await Promise.allSettled(
        teamOwners.map(async (owner) =>
          sendTeamDeleteEmail({
            email: owner.user.email,
            teamName: team.name,
            teamUrl: team.url,
            isOwner: true,
          }),
        ),
      );

      const memberSendEmailResults = await Promise.allSettled(
        teamMembers.map(async (member) =>
          sendTeamDeleteEmail({
            email: member.user.email,
            teamName: team.name,
            teamUrl: team.url,
            isOwner: false,
          }),
        ),
      );

      const sendEmailResult = [...ownerSendEmailResults, ...memberSendEmailResults];
      const sendEmailResultErrorList = sendEmailResult.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );

      if (sendEmailResultErrorList.length > 0) {
        console.error(JSON.stringify(sendEmailResultErrorList));

        throw new AppError(
          'EmailDeliveryFailed',
          'Failed to send invite emails to one or more users.',
          `Failed to send invites to ${sendEmailResultErrorList.length}/${team.members.length} users.`,
        );
      }

      await tx.team.delete({
        where: {
          id: teamId,
          ownerUserId: userId,
        },
      });
    },
    { timeout: 30_000 },
  );
};

type SendTeamDeleteEmailOptions = Omit<TeamDeleteEmailProps, 'baseUrl' | 'assetBaseUrl'> & {
  email: string;
  teamName: string;
};

export const sendTeamDeleteEmail = async ({
  email,
  ...emailTemplateOptions
}: SendTeamDeleteEmailOptions) => {
  const template = createElement(TeamDeleteEmailTemplate, {
    assetBaseUrl: WEBAPP_BASE_URL,
    baseUrl: WEBAPP_BASE_URL,
    ...emailTemplateOptions,
  });

  await mailer.sendMail({
    to: email,
    from: {
      name: FROM_NAME,
      address: FROM_ADDRESS,
    },
    subject: `Team "${emailTemplateOptions.teamName}" has been deleted on Documenso`,
    html: render(template),
    text: render(template, { plainText: true }),
  });
};
