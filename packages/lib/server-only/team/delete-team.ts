import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import type { TeamDeleteEmailProps } from '@documenso/email/templates/team-delete';
import { TeamDeleteEmailTemplate } from '@documenso/email/templates/team-delete';
import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { AppError } from '@documenso/lib/errors/app-error';
import { stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';

import { jobs } from '../../jobs/client';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

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
                  name: true,
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

      await jobs.triggerJob({
        name: 'send.team-deleted.email',
        payload: {
          team: {
            name: team.name,
            url: team.url,
            ownerUserId: team.ownerUserId,
          },
          members: team.members.map((member) => ({
            id: member.user.id,
            name: member.user.name || '',
            email: member.user.email,
          })),
        },
      });

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

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template),
    renderEmailWithI18N(template, { plainText: true }),
  ]);

  await mailer.sendMail({
    to: email,
    from: {
      name: FROM_NAME,
      address: FROM_ADDRESS,
    },
    subject: `Team "${emailTemplateOptions.teamName}" has been deleted on Documenso`,
    html,
    text,
  });
};
