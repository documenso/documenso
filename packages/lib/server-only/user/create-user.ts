import { hash } from '@node-rs/bcrypt';
import type { User } from '@prisma/client';
import { TeamMemberInviteStatus } from '@prisma/client';

import { getStripeCustomerByUser } from '@documenso/ee/server-only/stripe/get-customer';
import { updateSubscriptionItemQuantity } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { prisma } from '@documenso/prisma';

import { IS_BILLING_ENABLED } from '../../constants/app';
import { SALT_ROUNDS } from '../../constants/auth';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildLogger } from '../../utils/logger';

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
    throw new AppError(AppErrorCode.ALREADY_EXISTS);
  }

  if (url) {
    const urlExists = await prisma.user.findFirst({
      where: {
        url,
      },
    });

    if (urlExists) {
      throw new AppError('PROFILE_URL_TAKEN', {
        message: 'Profile username is taken',
        userMessage: 'The profile username is already taken',
      });
    }
  }

  const user = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword, // Todo: (RR7) Drop password.
        signature,
        url,
      },
    });

    // Todo: (RR7) Migrate to use this after RR7.
    // await tx.account.create({
    //   data: {
    //     userId: user.id,
    //     type: 'emailPassword', // Todo: (RR7)
    //     provider: 'DOCUMENSO', // Todo: (RR7) Enums
    //     providerAccountId: user.id.toString(),
    //     password: hashedPassword,
    //   },
    // });

    return user;
  });

  await onCreateUserHook(user).catch((err) => {
    // Todo: (RR7) Add logging.
    console.error(err);
  });

  return user;
};

/**
 * Should be run after a user is created.
 *
 * @returns User
 */
export const onCreateUserHook = async (user: User) => {
  const { email } = user;

  const acceptedTeamInvites = await prisma.teamMemberInvite.findMany({
    where: {
      status: TeamMemberInviteStatus.ACCEPTED,
      email: {
        equals: email,
        mode: 'insensitive',
      },
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

      const error = AppError.parseError(err);

      const logger = buildLogger();

      logger.error(error, {
        method: 'createUser',
        context: {
          appError: AppError.toJSON(error),
          userId: user.id,
        },
      });
    }
  }

  return user;
};
