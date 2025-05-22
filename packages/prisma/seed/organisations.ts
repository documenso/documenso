import type { OrganisationMemberRole } from '@prisma/client';
import { OrganisationMemberInviteStatus, type User } from '@prisma/client';
import { nanoid } from 'nanoid';

import { hashSync } from '@documenso/lib/server-only/auth/hash';
import { acceptOrganisationInvitation } from '@documenso/lib/server-only/organisation/accept-organisation-invitation';

import { prisma } from '..';
import { seedTestEmail } from './users';

export const seedOrganisationMembers = async ({
  members,
  organisationId,
}: {
  members: {
    email?: string;
    name?: string;
    organisationRole: OrganisationMemberRole;
  }[];
  organisationId: string;
}) => {
  const membersToInvite: {
    email: string;
    organisationRole: OrganisationMemberRole;
  }[] = [];

  const createdMembers: User[] = [];

  for (const member of members) {
    const email = member.email ?? seedTestEmail();

    const createdMember = await prisma.user.create({
      data: {
        name: member.name ?? 'Test user',
        email: email.toLowerCase(),
        password: hashSync('password'),
        emailVerified: new Date(),
      },
    });

    createdMembers.push(createdMember);

    membersToInvite.push({
      email: createdMember.email,
      organisationRole: member.organisationRole,
    });
  }

  await prisma.organisationMemberInvite.createMany({
    data: membersToInvite.map((invite) => ({
      email: invite.email,
      organisationId,
      organisationRole: invite.organisationRole,
      token: nanoid(32),
    })),
  });

  const invites = await prisma.organisationMemberInvite.findMany({
    where: {
      organisationId,
      status: OrganisationMemberInviteStatus.PENDING,
    },
  });

  await Promise.all(
    invites.map(async (invite) => {
      await acceptOrganisationInvitation({
        token: invite.token,
      });
    }),
  );

  return createdMembers;
};
