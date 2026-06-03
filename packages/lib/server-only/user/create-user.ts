import { hash } from '@node-rs/bcrypt';
import type { User } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { SALT_ROUNDS } from '../../constants/auth';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { generateDatabaseId } from '../../universal/id';

const PSD401_ORG_ID = 'org_psd401district';
const PSD401_MEMBER_GROUP_ID = 'org_group_psd401_member';
const PSD401_DEFAULT_TEAM_GROUP_ID = 'org_group_default_member';

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
    throw new AppError(AppErrorCode.ALREADY_EXISTS);
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

    return user;
  });

  await onCreateUserHook(user).catch((err) => {
    console.error(err);
  });

  return user;
};

export const onCreateUserHook = async (user: User) => {
  await addUserToPsd401Org(user.id);

  return user;
};

const addUserToPsd401Org = async (userId: number) => {
  const existing = await prisma.organisationMember.findFirst({
    where: { userId, organisationId: PSD401_ORG_ID },
  });

  if (existing) {
    return;
  }

  const memberId = generateDatabaseId('member');

  await prisma.organisationMember.create({
    data: {
      id: memberId,
      userId,
      organisationId: PSD401_ORG_ID,
      organisationGroupMembers: {
        create: [
          {
            id: generateDatabaseId('group_member'),
            groupId: PSD401_MEMBER_GROUP_ID,
          },
          {
            id: generateDatabaseId('group_member'),
            groupId: PSD401_DEFAULT_TEAM_GROUP_ID,
          },
        ],
      },
    },
  });
};
