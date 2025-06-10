import { getPortalSession } from '@documenso/ee/server-only/stripe/get-portal-session';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { prisma } from '@documenso/prisma';

export type CreateTeamBillingPortalOptions = {
  userId: number;
  teamId: number;
};

export const createTeamBillingPortal = async ({
  userId,
  teamId,
}: CreateTeamBillingPortalOptions) => {
  if (!IS_BILLING_ENABLED()) {
    throw new Error('Billing is not enabled');
  }

  const team = await prisma.team.findFirstOrThrow({
    where: {
      id: teamId,
      members: {
        some: {
          userId,
          role: {
            in: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_BILLING'],
          },
        },
      },
    },
    include: {
      subscription: true,
    },
  });

  if (!team.subscription) {
    throw new Error('Team has no subscription');
  }

  if (!team.customerId) {
    throw new Error('Team has no customerId');
  }

  return getPortalSession({
    customerId: team.customerId,
  });
};
