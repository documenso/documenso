import { customAlphabet } from 'nanoid';

import { prisma } from '..';
import type { Prisma } from '../client';
import { TeamMemberInviteStatus, TeamMemberRole } from '../client';
import { seedUser } from './users';

const EMAIL_DOMAIN = `test.documenso.com`;
const nanoid = customAlphabet('1234567890abcdef', 10);

type SeedTeamOptions = {
  createTeamMembers?: number;
  createTeamEmail?: true | string;
  createTeamOptions?: Partial<Prisma.TeamUncheckedCreateInput>;
};

export const seedTeam = async ({
  createTeamMembers = 0,
  createTeamEmail,
  createTeamOptions = {},
}: SeedTeamOptions = {}) => {
  const teamUrl = `team-${nanoid()}`;
  const teamEmail = createTeamEmail === true ? `${teamUrl}@${EMAIL_DOMAIN}` : createTeamEmail;

  const teamOwner = await seedUser({
    name: `${teamUrl}-original-owner`,
    email: `${teamUrl}-original-owner@${EMAIL_DOMAIN}`,
  });

  const teamMembers = await Promise.all(
    Array.from({ length: createTeamMembers }).map(async (_, i) => {
      return seedUser({
        name: `${teamUrl}-member-${i + 1}`,
        email: `${teamUrl}-member-${i + 1}@${EMAIL_DOMAIN}`,
      });
    }),
  );

  const team = await prisma.team.create({
    data: {
      name: teamUrl,
      url: teamUrl,
      ownerUserId: teamOwner.id,
      members: {
        createMany: {
          data: [teamOwner, ...teamMembers].map((user) => ({
            userId: user.id,
            role: user === teamOwner ? TeamMemberRole.ADMIN : TeamMemberRole.MEMBER,
          })),
        },
      },
      teamEmail: teamEmail
        ? {
            create: {
              email: teamEmail,
              name: teamEmail,
            },
          }
        : undefined,
      ...createTeamOptions,
    },
  });

  return await prisma.team.findFirstOrThrow({
    where: {
      id: team.id,
    },
    include: {
      owner: true,
      members: {
        include: {
          user: true,
        },
      },
      teamEmail: true,
      teamGlobalSettings: true,
    },
  });
};

export const unseedTeam = async (teamUrl: string) => {
  const team = await prisma.team.findUnique({
    where: {
      url: teamUrl,
    },
    include: {
      members: true,
    },
  });

  if (!team) {
    return;
  }

  await prisma.team.delete({
    where: {
      url: teamUrl,
    },
  });

  await prisma.user.deleteMany({
    where: {
      id: {
        in: team.members.map((member) => member.userId),
      },
    },
  });
};

type SeedTeamMemberOptions = {
  teamId: number;
  role?: TeamMemberRole;
  name?: string;
};

export const seedTeamMember = async ({
  teamId,
  name,
  role = TeamMemberRole.ADMIN,
}: SeedTeamMemberOptions) => {
  const user = await seedUser({ name });

  await prisma.teamMember.create({
    data: {
      teamId,
      role,
      userId: user.id,
    },
  });

  return user;
};

type UnseedTeamMemberOptions = {
  teamId: number;
  userId: number;
};

export const unseedTeamMember = async ({ teamId, userId }: UnseedTeamMemberOptions) => {
  await prisma.teamMember.delete({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });
};

export const seedTeamTransfer = async (options: { newOwnerUserId: number; teamId: number }) => {
  return await prisma.teamTransferVerification.create({
    data: {
      teamId: options.teamId,
      token: Date.now().toString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      userId: options.newOwnerUserId,
      name: '',
      email: '',
    },
  });
};

export const seedTeamEmail = async ({ email, teamId }: { email: string; teamId: number }) => {
  return await prisma.teamEmail.create({
    data: {
      name: email,
      email,
      teamId,
    },
  });
};

export const unseedTeamEmail = async ({ teamId }: { teamId: number }) => {
  return await prisma.teamEmail.delete({
    where: {
      teamId,
    },
  });
};

export const seedTeamInvite = async ({
  email,
  teamId,
  role = TeamMemberRole.ADMIN,
}: {
  email: string;
  teamId: number;
  role?: TeamMemberRole;
}) => {
  return await prisma.teamMemberInvite.create({
    data: {
      email,
      teamId,
      role,
      status: TeamMemberInviteStatus.PENDING,
      token: Date.now().toString(),
    },
  });
};

export const seedTeamEmailVerification = async ({
  email,
  teamId,
}: {
  email: string;
  teamId: number;
}) => {
  return await prisma.teamEmailVerification.create({
    data: {
      teamId,
      email,
      name: email,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      token: Date.now().toString(),
    },
  });
};

export const unseedTeamEmailVerification = async ({ teamId }: { teamId: number }) => {
  return await prisma.teamEmailVerification.delete({
    where: {
      teamId,
    },
  });
};
