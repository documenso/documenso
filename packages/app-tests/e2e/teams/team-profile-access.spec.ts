import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { TeamMemberRole } from '@documenso/prisma/client';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({ mode: 'parallel' });

/**
 * Editing the team public profile is a team-management action and must require
 * MANAGE_TEAM, consistent with renaming the team or changing its URL.
 */
test('[TEAMS]: a member cannot edit the team public profile', async ({ page }) => {
  const { team, owner } = await seedTeam();
  const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  await apiSignin({ page, email: member.email });

  const profileRes = await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/team.update`, {
    headers: { 'content-type': 'application/json', 'x-team-id': team.id.toString() },
    data: JSON.stringify({
      json: {
        teamId: team.id,
        data: { profileEnabled: true, profileBio: 'edited-by-member' },
      },
    }),
  });

  expect(profileRes.status()).not.toBe(200);

  const profile = await prisma.teamProfile.findUnique({ where: { teamId: team.id } });
  expect(profile?.enabled ?? false).toBe(false);
  expect(profile?.bio ?? '').not.toBe('edited-by-member');

  // The name/url path of the same route is also management-gated.
  const nameRes = await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/team.update`, {
    headers: { 'content-type': 'application/json', 'x-team-id': team.id.toString() },
    data: JSON.stringify({
      json: { teamId: team.id, data: { name: 'renamed-by-member' } },
    }),
  });

  expect(nameRes.status()).not.toBe(200);

  const reloaded = await prisma.team.findUnique({ where: { id: team.id } });
  expect(reloaded?.name).not.toBe('renamed-by-member');

  expect(owner.id).toBeTruthy();
});
