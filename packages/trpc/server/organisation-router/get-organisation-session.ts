import { getHighestOrganisationRoleInGroup } from '@documenso/lib/utils/organisations';
import { buildTeamWhereQuery, extractDerivedTeamSettings, getHighestTeamRoleInGroup } from '@documenso/lib/utils/teams';
import { computeOrganisationTwoFactorEnforcementStatus } from '@documenso/lib/utils/two-factor';
import { prisma } from '@documenso/prisma';
import type { Session, User } from '@prisma/client';

import { authenticatedProcedure } from '../trpc';
import { twoFactorBootstrap } from '../two-factor-enforcement/enforce';
import type { TGetOrganisationSessionResponse } from './get-organisation-session.types';
import { ZGetOrganisationSessionResponseSchema } from './get-organisation-session.types';

/**
 * Get all the organisations and teams a user belongs to.
 *
 * Exempt from 2FA enforcement: a blocked client must still be able to discover
 * its own enforcement state from this payload.
 */
export const getOrganisationSessionRoute = authenticatedProcedure
  .use(twoFactorBootstrap())
  .output(ZGetOrganisationSessionResponseSchema)
  .query(async ({ ctx }) => {
    return await getOrganisationSession({
      userId: ctx.user.id,
      user: ctx.user,
      session: ctx.session,
    });
  });

export type GetOrganisationSessionOptions = {
  userId: number;

  user: Pick<User, 'twoFactorEnabled' | 'twoFactorGraceStartedAt'>;
  session: Pick<Session, 'twoFactorVerified'> | null;
};

export const getOrganisationSession = async ({
  userId,
  user,
  session,
}: GetOrganisationSessionOptions): Promise<TGetOrganisationSessionResponse> => {
  const now = new Date();

  const organisations = await prisma.organisation.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      organisationClaim: true,
      organisationGlobalSettings: true,
      subscription: true,
      members: {
        where: {
          userId,
        },
        take: 1,
        select: {
          createdAt: true,
        },
      },
      groups: {
        where: {
          organisationGroupMembers: {
            some: {
              organisationMember: {
                userId,
              },
            },
          },
        },
      },
      teams: {
        where: buildTeamWhereQuery({ teamId: undefined, userId }),
        include: {
          teamGlobalSettings: true,
          teamEmail: { select: { email: true } },
          teamGroups: {
            where: {
              organisationGroup: {
                organisationGroupMembers: {
                  some: {
                    organisationMember: {
                      userId,
                    },
                  },
                },
              },
            },
            include: {
              organisationGroup: true,
            },
          },
        },
      },
    },
  });

  return organisations.map((organisation) => {
    // `members` must not leak into the payload: root.tsx serialises this return
    // value directly without passing through the output schema.
    const { organisationGlobalSettings, members, ...organisationPayload } = organisation;

    const [member] = members;

    return {
      ...organisationPayload,
      twoFactorEnforcement: computeOrganisationTwoFactorEnforcementStatus({
        organisationSettings: organisationGlobalSettings,
        memberCreatedAt: member?.createdAt ?? organisation.createdAt,
        userTwoFactorEnabled: user.twoFactorEnabled,
        userTwoFactorGraceStartedAt: user.twoFactorGraceStartedAt,
        sessionTwoFactorVerified: session?.twoFactorVerified ?? false,
        now,
      }),
      teams: organisation.teams.map((team) => {
        const derivedSettings = extractDerivedTeamSettings(organisationGlobalSettings, team.teamGlobalSettings);

        return {
          ...team,
          currentTeamRole: getHighestTeamRoleInGroup(team.teamGroups),
          preferences: {
            aiFeaturesEnabled: derivedSettings.aiFeaturesEnabled,
          },
        };
      }),
      currentOrganisationRole: getHighestOrganisationRoleInGroup(organisation.groups),
    };
  });
};
