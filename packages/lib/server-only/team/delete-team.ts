import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import type { OrganisationGlobalSettings } from '@prisma/client';
import { OrganisationGroupType, type Team } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import { TeamDeleteEmailTemplate } from '@documenso/email/templates/team-delete';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../utils/team-global-settings-to-branding';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamSettings } from './get-team-settings';

export type DeleteTeamOptions = {
  userId: number;
  teamId: number;
};

export const deleteTeam = async ({ userId, teamId }: DeleteTeamOptions) => {
  // Todo: orgs double check this.
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery(teamId, userId, TEAM_MEMBER_ROLE_PERMISSIONS_MAP['DELETE_TEAM']),
    include: {
      teamGroups: {
        include: {
          organisationGroup: {
            include: {
              organisationGroupMembers: {
                include: {
                  organisationMember: {
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
              },
            },
          },
        },
      },
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You are not authorized to delete this team',
    });
  }

  const settings = await getTeamSettings({
    userId,
    teamId,
  });

  await prisma.$transaction(
    async (tx) => {
      // Todo: orgs handle any subs?
      // if (team.subscription) {
      //   await stripe.subscriptions
      //     .cancel(team.subscription.planId, {
      //       prorate: false,
      //       invoice_now: true,
      //     })
      //     .catch((err) => {
      //       console.error(err);
      //       throw AppError.parseError(err);
      //     });
      // }

      await tx.team.delete({
        where: {
          id: teamId,
        },
      });

      // Purge all internal organisation groups that have no teams.
      await tx.organisationGroup.deleteMany({
        where: {
          type: OrganisationGroupType.INTERNAL_TEAM,
          teamGroups: {
            none: {},
          },
        },
      });

      // const members = team.teamGroups.flatMap((group) =>
      //   group.organisationGroup.organisationMembers.map((member) => ({
      //     id: member.user.id,
      //     name: member.user.name || '',
      //     email: member.user.email,
      //   })),
      // );

      // await jobs.triggerJob({
      //   name: 'send.team-deleted.email',
      //   payload: {
      //     team: {
      //       name: team.name,
      //       url: team.url,
      //       teamGlobalSettings: team.teamGlobalSettings, // Todo: orgs
      //     },
      //     members,
      //   },
      // });
    },
    { timeout: 30_000 },
  );
};

type SendTeamDeleteEmailOptions = {
  email: string;
  team: Pick<Team, 'id' | 'url' | 'name'>;
  settings: Omit<OrganisationGlobalSettings, 'id'>;
};

export const sendTeamDeleteEmail = async ({
  email,
  team,
  settings,
}: SendTeamDeleteEmailOptions) => {
  const template = createElement(TeamDeleteEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    teamUrl: team.url,
  });

  const branding = teamGlobalSettingsToBranding(settings, team.id);

  const lang = settings.documentLanguage;

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
