import { hash } from '@node-rs/bcrypt';

import { getStripeCustomerByUser } from '@documenso/ee/server-only/stripe/get-customer';
import { updateSubscriptionItemQuantity } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { prisma } from '@documenso/prisma';
import { IdentityProvider, Prisma, TeamMemberInviteStatus } from '@documenso/prisma/client';

import { IS_BILLING_ENABLED } from '../../constants/app';
import { SALT_ROUNDS } from '../../constants/auth';
import { AppError, AppErrorCode } from '../../errors/app-error';

export interface CreateUserOptions {
  name: string;
  email: string;
  password: string;
  signature?: string | null;
  url?: string;
}

export const createUser = async ({ name, email, password, signature, url }: CreateUserOptions) => {
  const hashedPassword = await hash(password, SALT_ROUNDS);

  const userExists = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (userExists) {
    throw new Error('User already exists');
  }

  if (url) {
    const urlExists = await prisma.user.findFirst({
      where: {
        url,
      },
    });

    if (urlExists) {
      throw new AppError(
        AppErrorCode.PROFILE_URL_TAKEN,
        'Profile username is taken',
        'The profile username is already taken',
      );
    }
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      signature,
      identityProvider: IdentityProvider.DOCUMENSO,
      url,
    },
  });

  const acceptedTeamInvites = await prisma.teamMemberInvite.findMany({
    where: {
      email: {
        equals: email,
        mode: Prisma.QueryMode.insensitive,
      },
      status: TeamMemberInviteStatus.ACCEPTED,
    },
  });

  // For each team invite, add the user to the team and delete the team invite.
  // If an error occurs, reset the invitation to not accepted.
  await Promise.allSettled(
    acceptedTeamInvites.map(async (invite) =>
      prisma
        .$transaction(
          async (tx) => {
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

            if (!IS_BILLING_ENABLED()) {
              return;
            }

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
                subscription: true,
              },
            });

            if (team.subscription) {
              await updateSubscriptionItemQuantity({
                priceId: team.subscription.priceId,
                subscriptionId: team.subscription.planId,
                quantity: team.members.length,
              });
            }
          },
          { timeout: 30_000 },
        )
        .catch(async () => {
          await prisma.teamMemberInvite.update({
            where: {
              id: invite.id,
            },
            data: {
              status: TeamMemberInviteStatus.PENDING,
            },
          });
        }),
    ),
  );

  // Update the user record with a new or existing Stripe customer record.
  if (IS_BILLING_ENABLED()) {
    try {
      return await getStripeCustomerByUser(user).then((session) => session.user);
    } catch (err) {
      console.error(err);
    }
  }

  return user;
};
