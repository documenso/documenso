import { prisma } from '@documenso/prisma';
import { hash } from '@node-rs/bcrypt';
import { OrganisationGroupType, OrganisationMemberRole, TeamMemberRole } from '@prisma/client';

import { SALT_ROUNDS } from '../../constants/auth';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { alphaid, generateDatabaseId } from '../../universal/id';
import { buildTeamWhereQuery } from '../../utils/teams';
import { hashString } from '../auth/hash';
import { addUserToOrganisation } from '../organisation/accept-organisation-invitation';
import { onCreateUserHook } from '../user/create-user';

type ProvisionTeamMemberOptions = {
  callerUserId: number;
  teamId: number;
  email: string;
  name: string;
  role?: TeamMemberRole;
  password?: string;
};

export const provisionTeamMember = async ({
  callerUserId,
  teamId,
  email,
  name,
  role = TeamMemberRole.MEMBER,
  password,
}: ProvisionTeamMemberOptions) => {
  const normalizedEmail = email.toLowerCase();

  // 1. Verify caller has MANAGE_TEAM permission on this team.
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery({
      teamId,
      userId: callerUserId,
      roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
    }),
    include: {
      organisation: {
        include: {
          groups: true,
          members: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      },
      teamGroups: {
        where: {
          organisationGroup: {
            type: OrganisationGroupType.INTERNAL_TEAM,
          },
        },
        include: {
          organisationGroup: true,
        },
      },
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Team not found or missing permissions',
    });
  }

  // 2. Find or create user.
  let user = await prisma.user.findFirst({
    where: { email: normalizedEmail },
  });

  if (!user) {
    const hashedPassword = password ? await hash(password, SALT_ROUNDS) : undefined;

    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        emailVerified: new Date(),
        password: hashedPassword,
      },
    });

    await onCreateUserHook(user, { skipPersonalOrganisation: true }).catch((err) => {
      console.error('onCreateUserHook error during provisioning:', err);
    });
  } else if (password && !user.password) {
    // Existing user without a password — set it so they can log in directly.
    const hashedPassword = await hash(password, SALT_ROUNDS);

    user = await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
  }

  // 3. Add to organisation if not already a member.
  let organisationMember = team.organisation.members.find((m) => m.userId === user.id);

  if (!organisationMember) {
    await addUserToOrganisation({
      userId: user.id,
      organisationId: team.organisationId,
      organisationGroups: team.organisation.groups,
      organisationMemberRole: OrganisationMemberRole.MEMBER,
      bypassEmail: true,
    });

    // Re-fetch to get the created organisationMember ID.
    const newMember = await prisma.organisationMember.findFirst({
      where: {
        userId: user.id,
        organisationId: team.organisationId,
      },
      select: { id: true, userId: true },
    });

    if (!newMember) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to create organisation member',
      });
    }

    organisationMember = newMember;
  }

  // 4. Add to team if not already a member.
  const targetTeamGroup = team.teamGroups.find(
    (group) => group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM && group.teamRole === role,
  );

  if (!targetTeamGroup) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Team group for role ${role} not found`,
    });
  }

  const existingTeamMembership = await prisma.organisationGroupMember.findFirst({
    where: {
      organisationMemberId: organisationMember.id,
      groupId: {
        in: team.teamGroups.map((g) => g.organisationGroupId),
      },
    },
  });

  if (!existingTeamMembership) {
    await prisma.organisationGroupMember.create({
      data: {
        id: generateDatabaseId('group_member'),
        organisationMemberId: organisationMember.id,
        groupId: targetTeamGroup.organisationGroupId,
      },
    });
  }

  // 5. Create a fresh API token (always new — caller only sees it once).
  const rawToken = `api_${alphaid(16)}`;
  const hashedToken = hashString(rawToken);

  await prisma.apiToken.create({
    data: {
      name: `fixos-provision-${Date.now()}`,
      token: hashedToken,
      userId: user.id,
      teamId,
      expires: null,
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    apiToken: rawToken,
  };
};
