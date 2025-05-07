import {
  OrganisationGroupType,
  OrganisationMemberRole,
  Prisma,
  TeamMemberRole,
} from '@prisma/client';
import type Stripe from 'stripe';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { createOrganisationCustomer } from '@documenso/ee/server-only/stripe/create-team-customer';
import { getTeamRelatedPrices } from '@documenso/ee/server-only/stripe/get-team-related-prices';
import { mapStripeSubscriptionToPrismaUpsertAction } from '@documenso/ee/server-only/stripe/webhook/on-subscription-updated';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { subscriptionsContainsActivePlan } from '@documenso/lib/utils/billing';
import { prisma } from '@documenso/prisma';

import {
  LOWEST_ORGANISATION_ROLE,
  ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP,
} from '../../constants/organisations';
import { TEAM_INTERNAL_GROUPS } from '../../constants/teams';
import { buildOrganisationWhereQuery } from '../../utils/organisations';
import { generateDefaultTeamSettings } from '../../utils/teams';
import { stripe } from '../stripe';

export type CreateTeamOptions = {
  /**
   * ID of the user creating the Team.
   */
  userId: number;

  /**
   * Name of the team to display.
   */
  teamName: string;

  /**
   * Unique URL of the team.
   *
   * Used as the URL path, example: https://documenso.com/t/{teamUrl}/settings
   */
  teamUrl: string;

  /**
   * ID of the organisation the team belongs to.
   */
  organisationId: string;

  /**
   * Whether to inherit all members from the organisation.
   */
  inheritMembers: boolean;

  /**
   * List of additional groups to attach to the team.
   */
  groups?: {
    id: string;
    role: TeamMemberRole;
  }[];
};

export const ZCreateTeamResponseSchema = z.union([
  z.object({
    paymentRequired: z.literal(false),
  }),
  z.object({
    paymentRequired: z.literal(true),
    pendingTeamId: z.number(),
  }),
]);

export type TCreateTeamResponse = z.infer<typeof ZCreateTeamResponseSchema>;

/**
 * Create a team or pending team depending on the user's subscription or application's billing settings.
 */
export const createTeam = async ({
  userId,
  teamName,
  teamUrl,
  organisationId,
  inheritMembers,
}: CreateTeamOptions): Promise<TCreateTeamResponse> => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery(
      organisationId,
      userId,
      ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    ),
    include: {
      groups: true, // Todo: (orgs)
      subscriptions: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found.',
    });
  }

  // Inherit internal organisation groups to the team.
  // Organisation Admins/Mangers get assigned as team admins, members get assigned as team members.
  const internalOrganisationGroups = organisation.groups
    .filter((group) => {
      if (group.type !== OrganisationGroupType.INTERNAL_ORGANISATION) {
        return false;
      }

      // If we're inheriting members, allow all internal organisation groups.
      if (inheritMembers) {
        return true;
      }

      // Otherwise, only inherit organisation admins/managers.
      return (
        group.organisationRole === OrganisationMemberRole.ADMIN ||
        group.organisationRole === OrganisationMemberRole.MANAGER
      );
    })
    .map((group) =>
      match(group.organisationRole)
        .with(OrganisationMemberRole.ADMIN, OrganisationMemberRole.MANAGER, () => ({
          organisationGroupId: group.id,
          teamRole: TeamMemberRole.ADMIN,
        }))
        .with(OrganisationMemberRole.MEMBER, () => ({
          organisationGroupId: group.id,
          teamRole: TeamMemberRole.MEMBER,
        }))
        .exhaustive(),
    );

  console.log({
    internalOrganisationGroups,
  });

  if (Date.now() > 0) {
    await prisma.$transaction(async (tx) => {
      const teamSettings = await tx.teamGlobalSettings.create({
        data: generateDefaultTeamSettings(),
      });

      const team = await tx.team.create({
        data: {
          name: teamName,
          url: teamUrl,
          organisationId,
          teamGlobalSettingsId: teamSettings.id,
          teamGroups: {
            createMany: {
              // Attach the internal organisation groups to the team.
              data: internalOrganisationGroups,
            },
          },
        },
        include: {
          teamGroups: true,
        },
      });

      // Create the internal team groups.
      await Promise.all(
        TEAM_INTERNAL_GROUPS.map(async (teamGroup) =>
          tx.organisationGroup.create({
            data: {
              type: teamGroup.type,
              organisationRole: LOWEST_ORGANISATION_ROLE,
              organisationId,
              teamGroups: {
                create: {
                  teamId: team.id,
                  teamRole: teamGroup.teamRole,
                },
              },
            },
          }),
        ),
      );
    });

    return {
      paymentRequired: false,
    };
  }

  if (Date.now() > 0) {
    throw new Error('Todo: Orgs');
  }

  let isPaymentRequired = IS_BILLING_ENABLED();
  let customerId: string | null = null;

  if (IS_BILLING_ENABLED()) {
    const teamRelatedPriceIds = await getTeamRelatedPrices().then((prices) =>
      prices.map((price) => price.id),
    );

    isPaymentRequired = !subscriptionsContainsActivePlan(
      organisation.subscriptions,
      teamRelatedPriceIds, // Todo: (orgs)
    );

    customerId = await createOrganisationCustomer({
      name: organisation.owner.name ?? teamName,
      email: organisation.owner.email,
    }).then((customer) => customer.id);

    await prisma.organisation.update({
      where: {
        id: organisationId,
      },
      data: {
        customerId,
      },
    });
  }

  try {
    // Create the team directly if no payment is required.
    if (!isPaymentRequired) {
      await prisma.team.create({
        data: {
          name: teamName,
          url: teamUrl,
          organisationId,
          members: {
            create: [
              {
                userId,
                role: TeamMemberRole.ADMIN, // Todo: (orgs)
              },
            ],
          },
          teamGlobalSettings: {
            create: {},
          },
        },
      });

      return {
        paymentRequired: false,
      };
    }

    // Create a pending team if payment is required.
    const pendingTeam = await prisma.$transaction(async (tx) => {
      const existingTeamWithUrl = await tx.team.findUnique({
        where: {
          url: teamUrl,
        },
      });

      const existingUserProfileWithUrl = await tx.user.findUnique({
        where: {
          url: teamUrl,
        },
        select: {
          id: true,
        },
      });

      if (existingUserProfileWithUrl) {
        throw new AppError(AppErrorCode.ALREADY_EXISTS, {
          message: 'URL already taken.',
        });
      }

      if (existingTeamWithUrl) {
        throw new AppError(AppErrorCode.ALREADY_EXISTS, {
          message: 'Team URL already exists.',
        });
      }

      if (!customerId) {
        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Missing customer ID for pending teams.',
        });
      }

      return await tx.teamPending.create({
        data: {
          name: teamName,
          url: teamUrl,
          ownerUserId: user.id,
          customerId,
        },
      });
    });

    return {
      paymentRequired: true,
      pendingTeamId: pendingTeam.id,
    };
  } catch (err) {
    console.error(err);

    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
      throw err;
    }

    const target = z.array(z.string()).safeParse(err.meta?.target);

    if (err.code === 'P2002' && target.success && target.data.includes('url')) {
      throw new AppError(AppErrorCode.ALREADY_EXISTS, {
        message: 'Team URL already exists.',
      });
    }

    throw err;
  }
};

export type CreateTeamFromPendingTeamOptions = {
  pendingTeamId: number;
  subscription: Stripe.Subscription;
};

export const createTeamFromPendingTeam = async ({
  pendingTeamId,
  subscription,
}: CreateTeamFromPendingTeamOptions) => {
  const createdTeam = await prisma.$transaction(async (tx) => {
    const pendingTeam = await tx.teamPending.findUniqueOrThrow({
      where: {
        id: pendingTeamId,
      },
    });

    await tx.teamPending.delete({
      where: {
        id: pendingTeamId,
      },
    });

    const team = await tx.team.create({
      data: {
        name: pendingTeam.name,
        url: pendingTeam.url,
        ownerUserId: pendingTeam.ownerUserId,
        customerId: pendingTeam.customerId,
        members: {
          create: [
            {
              userId: pendingTeam.ownerUserId,
              role: TeamMemberRole.ADMIN,
            },
          ],
        },
      },
    });

    await tx.teamGlobalSettings.upsert({
      where: {
        teamId: team.id,
      },
      update: {},
      create: {
        teamId: team.id,
      },
    });

    await tx.subscription.upsert(
      mapStripeSubscriptionToPrismaUpsertAction(subscription, undefined, team.id),
    );

    return team;
  });

  // Attach the team ID to the subscription metadata for sanity reasons.
  await stripe.subscriptions
    .update(subscription.id, {
      metadata: {
        teamId: createdTeam.id.toString(),
      },
    })
    .catch((e) => {
      console.error(e);
      // Non-critical error, but we want to log it so we can rectify it.
      // Todo: Teams - Alert us.
    });

  return createdTeam;
};
