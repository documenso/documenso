import type { OrganisationMemberRole, OrganisationType } from '@prisma/client';
import { OrganisationGroupType, type User } from '@prisma/client';

import { hashSync } from '@documenso/lib/server-only/auth/hash';
import { addUserToOrganisation } from '@documenso/lib/server-only/organisation/accept-organisation-invitation';

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

  const organisationGroups = await prisma.organisationGroup.findMany({
    where: {
      organisationId,
      type: OrganisationGroupType.INTERNAL_ORGANISATION,
    },
  });

  for (const member of members) {
    const email = member.email ?? seedTestEmail();

    let newUser = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (!newUser) {
      newUser = await prisma.user.create({
        data: {
          name: member.name ?? 'Test user',
          email: email.toLowerCase(),
          password: hashSync('password'),
          emailVerified: new Date(),
        },
      });
    }

    createdMembers.push(newUser);

    membersToInvite.push({
      email: newUser.email,
      organisationRole: member.organisationRole,
    });

    await addUserToOrganisation({
      userId: newUser.id,
      organisationId,
      organisationGroups,
      organisationMemberRole: member.organisationRole,
      bypassEmail: true,
    });
  }

  return createdMembers;
};

export const setOrganisationType = async ({
  organisationId,
  type,
}: {
  organisationId: string;
  type: OrganisationType;
}) => {
  await prisma.organisation.update({
    where: {
      id: organisationId,
    },
    data: {
      type,
    },
  });
};
