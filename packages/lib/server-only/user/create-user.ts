import { hash } from 'bcrypt';

import { getStripeCustomerByUser } from '@documenso/ee/server-only/stripe/get-customer';
import { updateSubscriptionItemQuantity } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { prisma } from '@documenso/prisma';
import { IdentityProvider, Prisma, TeamMemberInviteStatus } from '@documenso/prisma/client';

import { IS_BILLING_ENABLED } from '../../constants/app';
import { SALT_ROUNDS } from '../../constants/auth';
import { getTeamSeatPriceId } from '../../utils/billing';

export interface CreateUserOptions {
  name: string;
  email: string;
  password: string;
  signature?: string | null;
}

export const createUser = async ({ name, email, password, signature }: CreateUserOptions) => {
  const hashedPassword = await hash(password, SALT_ROUNDS);

  const userExists = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (userExists) {
    throw new Error('User already exists');
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        signature,
        identityProvider: IdentityProvider.DOCUMENSO,
      },
    });

    const acceptedTeamInvites = await tx.teamMemberInvite.findMany({
      where: {
        email: {
          equals: email,
          mode: Prisma.QueryMode.insensitive,
        },
        status: TeamMemberInviteStatus.ACCEPTED,
      },
    });

    // For each team invite, add the user to the team and delete the team invite.
    await Promise.all(
      acceptedTeamInvites.map(async (invite) => {
        await tx.teamMember.create({
          data: {
            teamId: invite.teamId,
            userId: user.id,
            role: invite.role,
          },
        });

        await tx.teamMemberInvite.delete({
          where: {
            id: invite.id,
          },
        });

        if (IS_BILLING_ENABLED) {
          const team = await tx.team.findFirstOrThrow({
            where: {
              id: invite.teamId,
            },
            include: {
              members: {
                select: {
                  id: true,
                },
              },
            },
          });

          if (team.subscriptionId) {
            await updateSubscriptionItemQuantity({
              priceId: getTeamSeatPriceId(),
              subscriptionId: team.subscriptionId,
              quantity: team.members.length,
            });
          }
        }
      }),
    );

    if (IS_BILLING_ENABLED) {
      try {
        return await getStripeCustomerByUser(user).then((session) => session.user);
      } catch (err) {
        console.error(err);
      }
    }

    return user;
  });
};
