import { expect, test } from '@playwright/test';
import { TeamMemberRole } from '@prisma/client';

import {
  ZFindTeamMembersResponseSchema,
  ZSuccessfulInviteTeamMemberResponseSchema,
  ZSuccessfulRemoveTeamMemberResponseSchema,
  ZSuccessfulUpdateTeamMemberResponseSchema,
  ZUnsuccessfulResponseSchema,
} from '@documenso/api/v1/schema';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';

test.describe('Team API', () => {
  test('findTeamMembers: should list team members', async ({ request }) => {
    const team = await seedTeam({
      createTeamMembers: 3,
    });

    const ownerMember = team.members.find((member) => member.userId === team.owner.id)!;

    // Should not be undefined
    expect(ownerMember).toBeTruthy();

    const { token } = await createApiToken({
      userId: team.owner.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.get(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/team/${team.id}/members`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();

    const parsed = ZFindTeamMembersResponseSchema.safeParse(data);

    const safeData = parsed.success ? parsed.data : null;

    expect(parsed.success).toBeTruthy();

    expect(safeData!.members).toHaveLength(4); // Owner + 3 members
    expect(safeData!.members[0]).toHaveProperty('id');
    expect(safeData!.members[0]).toHaveProperty('email');
    expect(safeData!.members[0]).toHaveProperty('role');

    expect(safeData!.members).toContainEqual({
      id: ownerMember.id,
      email: ownerMember.user.email,
      role: ownerMember.role,
    });
  });

  test('inviteTeamMember: should invite a new team member', async ({ request }) => {
    const team = await seedTeam();

    const { token } = await createApiToken({
      userId: team.owner.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const newUser = await seedUser();

    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/team/${team.id}/members/invite`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          email: newUser.email,
          role: TeamMemberRole.MEMBER,
        },
      },
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();

    const parsed = ZSuccessfulInviteTeamMemberResponseSchema.safeParse(data);

    const safeData = parsed.success ? parsed.data : null;

    expect(parsed.success).toBeTruthy();
    expect(safeData!.message).toBe('An invite has been sent to the member');

    const invite = await prisma.teamMemberInvite.findFirst({
      where: {
        email: newUser.email,
        teamId: team.id,
      },
    });

    expect(invite).toBeTruthy();
  });

  test('updateTeamMember: should update a team member role', async ({ request }) => {
    const team = await seedTeam({
      createTeamMembers: 3,
    });

    const { token } = await createApiToken({
      userId: team.owner.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const member = team.members.find((member) => member.role === TeamMemberRole.MEMBER)!;

    // Should not be undefined
    expect(member).toBeTruthy();

    const response = await request.put(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/team/${team.id}/members/${member.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          role: TeamMemberRole.ADMIN,
        },
      },
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();

    const parsed = ZSuccessfulUpdateTeamMemberResponseSchema.safeParse(data);

    const safeData = parsed.success ? parsed.data : null;

    expect(parsed.success).toBeTruthy();

    expect(safeData!.id).toBe(member.id);
    expect(safeData!.email).toBe(member.user.email);
    expect(safeData!.role).toBe(TeamMemberRole.ADMIN);
  });

  test('removeTeamMember: should remove a team member', async ({ request }) => {
    const team = await seedTeam({
      createTeamMembers: 3,
    });

    const { token } = await createApiToken({
      userId: team.owner.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const member = team.members.find((member) => member.role === TeamMemberRole.MEMBER)!;

    // Should not be undefined
    expect(member).toBeTruthy();

    const response = await request.delete(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/team/${team.id}/members/${member.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status()).toBe(200);

    const data = await response.json();

    const parsed = ZSuccessfulRemoveTeamMemberResponseSchema.safeParse(data);

    const safeData = parsed.success ? parsed.data : null;

    expect(parsed.success).toBeTruthy();

    expect(safeData!.id).toBe(member.id);
    expect(safeData!.email).toBe(member.user.email);
    expect(safeData!.role).toBe(member.role);

    const removedMemberCount = await prisma.teamMember.count({
      where: {
        id: member.id,
        teamId: team.id,
      },
    });

    expect(removedMemberCount).toBe(0);
  });

  test('removeTeamMember: should not remove team owner', async ({ request }) => {
    const team = await seedTeam({
      createTeamMembers: 3,
    });

    const { token } = await createApiToken({
      userId: team.owner.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const ownerMember = team.members.find((member) => member.userId === team.owner.id)!;

    // Should not be undefined
    expect(ownerMember).toBeTruthy();

    const response = await request.delete(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/team/${team.id}/members/${ownerMember.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status()).toBe(403);

    const parsed = ZUnsuccessfulResponseSchema.safeParse(await response.json());

    expect(parsed.success).toBeTruthy();
  });

  test('removeTeamMember: should not remove self', async ({ request }) => {
    const team = await seedTeam({
      createTeamMembers: 3,
    });

    const member = team.members.find((member) => member.role === TeamMemberRole.MEMBER)!;

    // Make our non-owner member an admin
    await prisma.teamMember.update({
      where: {
        id: member.id,
      },
      data: {
        role: TeamMemberRole.ADMIN,
      },
    });

    const { token } = await createApiToken({
      userId: member.userId,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.delete(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/team/${team.id}/members/${member.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status()).toBe(403);

    const parsed = ZUnsuccessfulResponseSchema.safeParse(await response.json());

    expect(parsed.success).toBeTruthy();
  });
});
