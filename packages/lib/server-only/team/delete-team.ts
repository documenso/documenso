import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import type { Team, TeamGlobalSettings } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import { TeamDeleteEmailTemplate } from '@documenso/email/templates/team-delete';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { AppError } from '@documenso/lib/errors/app-error';
import { stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { jobs } from '../../jobs/client';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../utils/team-global-settings-to-branding';

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
          teamGlobalSettings: true,
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
            teamGlobalSettings: team.teamGlobalSettings,
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

type SendTeamDeleteEmailOptions = {
  email: string;
  team: Pick<Team, 'url' | 'name'> & {
    teamGlobalSettings?: TeamGlobalSettings | null;
  };
  isOwner: boolean;
};

export const sendTeamDeleteEmail = async ({ email, isOwner, team }: SendTeamDeleteEmailOptions) => {
  const template = createElement(TeamDeleteEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    teamUrl: team.url,
    isOwner,
  });

  const branding = team.teamGlobalSettings
    ? teamGlobalSettingsToBranding(team.teamGlobalSettings)
    : undefined;

  const lang = team.teamGlobalSettings?.documentLanguage;

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template, { lang, branding }),
    renderEmailWithI18N(template, { lang, branding, plainText: true }),
  ]);

  const i18n = await getI18nInstance(lang);

  await mailer.sendMail({
    to: email,
    from: {
      name: FROM_NAME,
      address: FROM_ADDRESS,
    },
    subject: i18n._(msg`Team "${team.name}" has been deleted on Documenso`),
    html,
    text,
  });
};
