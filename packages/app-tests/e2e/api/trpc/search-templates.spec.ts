import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { OrganisationMemberRole, TeamMemberRole } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin, apiSignout } from '../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

const trpcTemplateSearch = async (page: Page, query: string) => {
  const inputParam = encodeURIComponent(JSON.stringify({ json: { query } }));
  const url = `${WEBAPP_BASE_URL}/api/trpc/template.search?input=${inputParam}`;

  const res = await page.context().request.get(url);

  return {
    res,
    data: res.ok()
      ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ((await res.json()).result.data.json as Array<{
          title: string;
          path: string;
          value: string;
        }>)
      : null,
  };
};

// ─── Visibility ──────────────────────────────────────────────────────────────

test.describe('Template Search - Visibility', () => {
  test('should respect team template visibility per role', async ({ page }) => {
    const { user: owner, organisation, team } = await seedUser();

    const [adminUser, managerUser, memberUser] = await seedOrganisationMembers({
      organisationId: organisation.id,
      members: [
        { organisationRole: OrganisationMemberRole.ADMIN },
        { organisationRole: OrganisationMemberRole.MEMBER },
        { organisationRole: OrganisationMemberRole.MEMBER },
      ],
    });

    const managerTeamGroup = await prisma.teamGroup.findFirstOrThrow({
      where: { teamId: team.id, teamRole: TeamMemberRole.MANAGER },
      include: { organisationGroup: true },
    });

    const managerOrganisationMember = await prisma.organisationMember.findFirstOrThrow({
      where: { organisationId: organisation.id, userId: managerUser.id },
    });

    await prisma.organisationGroupMember.create({
      data: {
        id: generateDatabaseId('group_member'),
        groupId: managerTeamGroup.organisationGroupId,
        organisationMemberId: managerOrganisationMember.id,
      },
    });

    await seedBlankTemplate(owner, team.id, {
      createTemplateOptions: {
        visibility: 'EVERYONE',
        title: 'Searchable Template for Everyone',
      },
    });

    await seedBlankTemplate(owner, team.id, {
      createTemplateOptions: {
        visibility: 'MANAGER_AND_ABOVE',
        title: 'Searchable Template for Managers',
      },
    });

    await seedBlankTemplate(owner, team.id, {
      createTemplateOptions: {
        visibility: 'ADMIN',
        title: 'Searchable Template for Admins',
      },
    });

    const testCases = [
      { user: adminUser, visibleTemplates: 3 },
      { user: managerUser, visibleTemplates: 2 },
      { user: memberUser, visibleTemplates: 1 },
    ];

    for (const { user, visibleTemplates } of testCases) {
      await apiSignin({ page, email: user.email });

      const { data } = await trpcTemplateSearch(page, 'Searchable Template');

      expect(data).not.toBeNull();
      expect(data).toHaveLength(visibleTemplates);

      await apiSignout({ page });
    }
  });
});

// ─── Cross-Team Isolation ────────────────────────────────────────────────────

test.describe('Template Search - Cross-Team Isolation', () => {
  test('should not reveal templates from other teams', async ({ page }) => {
    const { team: teamA, owner: ownerA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    const memberA = await seedTeamMember({ teamId: teamA.id, role: TeamMemberRole.MEMBER });

    await seedBlankTemplate(ownerA, teamA.id, {
      createTemplateOptions: {
        visibility: 'EVERYONE',
        title: 'Unique Team A Template',
      },
    });

    await seedBlankTemplate(ownerB, teamB.id, {
      createTemplateOptions: {
        visibility: 'EVERYONE',
        title: 'Unique Team B Template',
      },
    });

    await apiSignin({ page, email: memberA.email });

    const { data } = await trpcTemplateSearch(page, 'Unique');

    expect(data).not.toBeNull();
    const titles = data!.map((d) => d.title);

    expect(titles).toContain('Unique Team A Template');
    expect(titles).not.toContain('Unique Team B Template');

    await apiSignout({ page });
  });

  test('should not cross team boundaries when searching SQL wildcard "%"', async ({ page }) => {
    const { team: teamA, owner: ownerA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    await seedBlankTemplate(ownerA, teamA.id, {
      createTemplateOptions: { title: 'Wildcard Tpl A' },
    });

    await seedBlankTemplate(ownerB, teamB.id, {
      createTemplateOptions: { title: 'Wildcard Tpl B' },
    });

    await apiSignin({ page, email: ownerA.email });

    const { data } = await trpcTemplateSearch(page, '%');

    expect(data).not.toBeNull();
    expect(data!.map((d) => d.title)).not.toContain('Wildcard Tpl B');

    await apiSignout({ page });
  });
});

// ─── Recipient Email Search ──────────────────────────────────────────────────

test.describe('Template Search - Recipient Email', () => {
  test('should find templates by recipient email within team but not cross-team', async ({
    page,
  }) => {
    const { team: teamA, owner: ownerA } = await seedTeam();
    const adminUserA = await seedTeamMember({ teamId: teamA.id, role: TeamMemberRole.ADMIN });
    const { team: teamB, owner: ownerB } = await seedTeam();

    const { user: uniqueRecipient } = await seedUser();

    const template = await seedBlankTemplate(ownerA, teamA.id, {
      createTemplateOptions: { title: 'Template with Unique Recipient' },
    });

    await prisma.recipient.create({
      data: {
        email: uniqueRecipient.email,
        name: uniqueRecipient.name ?? '',
        token: Math.random().toString().slice(2, 7),
        envelopeId: template.id,
      },
    });

    // Team admin can find the template by recipient email.
    await apiSignin({ page, email: adminUserA.email });

    const { data: adminData } = await trpcTemplateSearch(page, uniqueRecipient.email);

    expect(adminData).not.toBeNull();
    expect(adminData).toHaveLength(1);
    expect(adminData![0].title).toBe('Template with Unique Recipient');

    await apiSignout({ page });

    // Owner of a different team cannot find it.
    await apiSignin({ page, email: ownerB.email });

    const { data: otherTeamData } = await trpcTemplateSearch(page, uniqueRecipient.email);

    expect(otherTeamData).not.toBeNull();
    expect(otherTeamData).toHaveLength(0);

    await apiSignout({ page });
  });
});

// ─── Filtering ───────────────────────────────────────────────────────────────

test.describe('Template Search - Filtering', () => {
  test('should exclude soft-deleted templates', async ({ page }) => {
    const { team, owner } = await seedTeam();

    await seedBlankTemplate(owner, team.id, {
      createTemplateOptions: { title: 'Active Findable Template' },
    });

    const deletedTemplate = await seedBlankTemplate(owner, team.id, {
      createTemplateOptions: { title: 'Deleted Findable Template' },
    });

    await prisma.envelope.update({
      where: { id: deletedTemplate.id },
      data: { deletedAt: new Date() },
    });

    await apiSignin({ page, email: owner.email });

    const { data } = await trpcTemplateSearch(page, 'Findable Template');

    expect(data).not.toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].title).toBe('Active Findable Template');

    await apiSignout({ page });
  });
});

// ─── Authentication ──────────────────────────────────────────────────────────

test.describe('Template Search - Authentication', () => {
  test('should reject unauthenticated requests', async ({ page }) => {
    const { res } = await trpcTemplateSearch(page, 'anything');

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });
});
