import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import { OrganisationGroupType, type Team } from '@prisma/client';
import { uniqueBy } from 'remeda';

import { mailer } from '@documenso/email/mailer';
import { TeamDeleteEmailTemplate } from '@documenso/email/templates/team-delete';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { jobs } from '../../jobs/client';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getEmailContext } from '../email/get-email-context';

export type DeleteTeamOptions = {
  userId: number;
  teamId: number;
};

export const deleteTeam = async ({ userId, teamId }: DeleteTeamOptions) => {
  // Todo: orgs double check this.
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery(teamId, userId, TEAM_MEMBER_ROLE_PERMISSIONS_MAP['DELETE_TEAM']),
    include: {
      organisation: {
        select: {
          organisationGlobalSettings: true,
        },
      },
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

  const membersToNotify = uniqueBy(
    team.teamGroups.flatMap((group) =>
      group.organisationGroup.organisationGroupMembers.map((member) => ({
        id: member.organisationMember.user.id,
        name: member.organisationMember.user.name || '',
        email: member.organisationMember.user.email,
      })),
    ),
    (member) => member.id,
  );

  await prisma.$transaction(
    async (tx) => {
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

      await jobs.triggerJob({
        name: 'send.team-deleted.email',
        payload: {
          team: {
            name: team.name,
            url: team.url,
          },
          members: membersToNotify,
          organisationId: team.organisationId,
        },
      });
    },
    { timeout: 30_000 },
  );
};

type SendTeamDeleteEmailOptions = {
  email: string;
  team: Pick<Team, 'url' | 'name'>;
  organisationId: string;
};

export const sendTeamDeleteEmail = async ({
  email,
  team,
  organisationId,
}: SendTeamDeleteEmailOptions) => {
  const template = createElement(TeamDeleteEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    teamUrl: team.url,
  });

  const { branding, settings } = await getEmailContext({
    source: {
      type: 'organisation',
      organisationId,
    },
  });

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
