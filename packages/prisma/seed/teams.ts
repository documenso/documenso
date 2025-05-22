import { customAlphabet } from 'nanoid';

import { prisma } from '..';
import type { Prisma } from '../client';
import { OrganisationMemberRole, TeamMemberRole } from '../client';
import { seedOrganisationMembers } from './organisations';
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
  const {
    user: owner,
    team: seededTeam,
    organisation: seededOrganisation,
  } = await seedUser({
    name: 'Owner',
    teamEmail: createTeamEmail === true ? `${nanoid()}@${EMAIL_DOMAIN}` : createTeamEmail,
  });

  const teamUrl = seededTeam.url;

  await seedOrganisationMembers({
    members: Array.from({ length: createTeamMembers }).map((_, i) => ({
      name: `${teamUrl}-member-${i + 1}`,
      email: `${teamUrl}-member-${i + 1}@${EMAIL_DOMAIN}`,
      organisationRole: OrganisationMemberRole.MEMBER,
    })),
    organisationId: seededOrganisation.id,
  });

  const team = await prisma.team.findFirstOrThrow({
    where: {
      id: seededTeam.id,
    },
    include: {
      teamEmail: true,
      teamGlobalSettings: true,
    },
  });

  const organisation = await prisma.organisation.findFirstOrThrow({
    where: {
      id: seededOrganisation.id,
    },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  return {
    owner,
    team,
    organisation,
  };
};

export const unseedTeam = async (teamUrl: string) => {
  const team = await prisma.team.findUnique({
    where: {
      url: teamUrl,
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
