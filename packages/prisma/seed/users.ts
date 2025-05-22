import { customAlphabet } from 'nanoid';

import { hashSync } from '@documenso/lib/server-only/auth/hash';
import { createPersonalOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';

import { prisma } from '..';

type SeedUserOptions = {
  name?: string;
  email?: string;
  password?: string;
  verified?: boolean;
  setTeamEmailAsOwner?: boolean;
  teamEmail?: string;
  inheritMembers?: boolean;
};

const nanoid = customAlphabet('1234567890abcdef', 10);

export const seedTestEmail = () => `${nanoid()}@test.documenso.com`;

export const seedUser = async ({
  name = nanoid(),
  email,
  password = 'password',
  verified = true,
  setTeamEmailAsOwner = false,
  teamEmail = '',
  inheritMembers = true,
}: SeedUserOptions = {}) => {
  if (!email) {
    email = `${nanoid()}@test.documenso.com`;
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: hashSync(password),
      emailVerified: verified ? new Date() : undefined,
    },
  });

  await createPersonalOrganisation({ userId: user.id, inheritMembers });

  const organisation = await prisma.organisation.findFirstOrThrow({
    where: {
      ownerUserId: user.id,
    },
    include: {
      teams: true,
    },
  });

  if (setTeamEmailAsOwner) {
    await prisma.teamEmail.create({
      data: {
        name: '',
        teamId: organisation.teams[0].id,
        email: user.email,
      },
    });
  }

  if (teamEmail) {
    await prisma.teamEmail.create({
      data: {
        name: '',
        teamId: organisation.teams[0].id,
        email: teamEmail,
      },
    });
  }

  return {
    user,
    organisation,
    team: organisation.teams[0],
  };
};

export const unseedUser = async (userId: number) => {
  await prisma.user.delete({
    where: {
      id: userId,
    },
  });
};

export const unseedUserByEmail = async (email: string) => {
  await prisma.user.delete({
    where: {
      email,
    },
  });
};

export const extractUserVerificationToken = async (email: string) => {
  return await prisma.verificationToken.findFirstOrThrow({
    where: {
      identifier: 'confirmation-email',
      user: {
        email,
      },
    },
  });
};
