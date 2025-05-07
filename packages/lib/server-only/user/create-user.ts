import { hash } from '@node-rs/bcrypt';
import type { User } from '@prisma/client';
import { OrganisationGroupType, OrganisationMemberInviteStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { IS_BILLING_ENABLED } from '../../constants/app';
import { SALT_ROUNDS } from '../../constants/auth';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { createPersonalOrganisation } from '../organisation/create-organisation';

export interface CreateUserOptions {
  name: string;
  email: string;
  password: string;
  signature?: string | null;
  orgUrl: string;
}

export const createUser = async ({
  name,
  email,
  password,
  signature,
  orgUrl,
}: CreateUserOptions) => {
  const hashedPassword = await hash(password, SALT_ROUNDS);

  const userExists = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (userExists) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS);
  }

  // Todo: orgs handle htis
  if (orgUrl) {
    const urlExists = await prisma.team.findFirst({
      where: {
        url: orgUrl,
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

  await createPersonalOrganisation({ userId: user.id, orgUrl });

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

  const acceptedOrganisationInvites = await prisma.organisationMemberInvite.findMany({
    where: {
      status: OrganisationMemberInviteStatus.ACCEPTED,
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
    include: {
      organisation: {
        include: {
          groups: {
            where: {
              type: OrganisationGroupType.INTERNAL_ORGANISATION,
            },
          },
        },
      },
    },
  });

  // For each team invite, add the user to the organisation and team, then delete the team invite.
  // If an error occurs, reset the invitation to not accepted.
  await Promise.allSettled(
    acceptedOrganisationInvites.map(async (invite) =>
      prisma
        .$transaction(
          async (tx) => {
            const organisationGroupToUse = invite.organisation.groups.find(
              (group) =>
                group.type === OrganisationGroupType.INTERNAL_ORGANISATION &&
                group.organisationRole === invite.organisationRole,
            );

            if (!organisationGroupToUse) {
              throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
                message: 'Organisation group not found',
              });
            }

            await tx.organisationMember.create({
              data: {
                organisationId: invite.organisationId,
                userId: user.id,
                organisationGroupMembers: {
                  create: {
                    groupId: organisationGroupToUse.id,
                  },
                },
              },
            });

            await tx.organisationMemberInvite.delete({
              where: {
                id: invite.id,
              },
            });

            if (!IS_BILLING_ENABLED()) {
              return;
            }

            const organisation = await tx.organisation.findFirstOrThrow({
              where: {
                id: invite.organisationId,
              },
              include: {
                members: {
                  select: {
                    id: true,
                  },
                },
                subscriptions: {
                  select: {
                    id: true,
                    priceId: true,
                    planId: true,
                  },
                },
              },
            });

            // const organisationSeatSubscription =  // TODO

            // if (organisation.subscriptions) {
            //   await updateSubscriptionItemQuantity({
            //     priceId: team.subscription.priceId,
            //     subscriptionId: team.subscription.planId,
            //     quantity: team.members.length,
            //   });
            // }
          },
          { timeout: 30_000 },
        )
        .catch(async () => {
          await prisma.organisationMemberInvite.update({
            where: {
              id: invite.id,
            },
            data: {
              status: OrganisationMemberInviteStatus.PENDING,
            },
          });
        }),
    ),
  );

  return user;
};
