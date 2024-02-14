import { prisma } from '..';
import { TeamMemberInviteStatus, TeamMemberRole } from '../client';
import { seedUser } from './users';

const EMAIL_DOMAIN = `test.documenso.com`;

type SeedTeamOptions = {
  createTeamMembers?: number;
  createTeamEmail?: true | string;
};

export const seedTeam = async ({
  createTeamMembers = 0,
  createTeamEmail,
}: SeedTeamOptions = {}) => {
  const teamUrl = `team-${Date.now()}`;
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
            role: TeamMemberRole.ADMIN,
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
