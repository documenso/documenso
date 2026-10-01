import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { prisma } from '@documenso/prisma';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import type { APIResponse, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DocumentVisibility, FolderType, TeamMemberRole, TemplateType } from '@prisma/client';
import { customAlphabet } from 'nanoid';

import { apiSignin, apiSignout } from '../fixtures/authentication';

const nanoid = customAlphabet('1234567890abcdef', 10);

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

type FindTemplatesResult = {
  data: Array<{ title: string; userId: number; teamId: number }>;
  count: number;
};

type TrpcResponse = {
  response: APIResponse;
  result: FindTemplatesResult | null;
};

const trpcQuery = async (
  page: Page,
  procedure: string,
  input: Record<string, unknown>,
  teamId?: number,
): Promise<TrpcResponse> => {
  const inputParam = encodeURIComponent(JSON.stringify({ json: { page: 1, perPage: 50, ...input } }));
  const url = `${WEBAPP_BASE_URL}/api/trpc/${procedure}?input=${inputParam}`;

  const headers: Record<string, string> = teamId ? { 'x-team-id': teamId.toString() } : {};

  const response = await page.context().request.get(url, { headers });

  const json = response.ok() ? await response.json() : null;
  const result: FindTemplatesResult | null = json ? json.result.data.json : null;

  return { response, result };
};

const FIND_TEMPLATE_PROCEDURES = ['template.findTemplates', 'template.findTemplatesInternal'] as const;

const titlesOf = (res: TrpcResponse) => (res.result?.data ?? []).map((row) => row.title);

const expectRejected = (res: TrpcResponse, status: number) => {
  expect(res.response.status()).toBe(status);
  expect(res.result).toBeNull();
};

// Check both count and data so one cannot be wrong while the other looks fine.
const expectNoResults = (res: TrpcResponse) => {
  expect(res.response.ok()).toBeTruthy();
  expect(res.result?.count).toBe(0);
  expect(res.result?.data).toEqual([]);
};

const expectExactTitles = (res: TrpcResponse, titles: string[], teamId: number) => {
  expect(res.response.ok()).toBeTruthy();
  expect(res.result?.count).toBe(titles.length);
  expect(titlesOf(res).sort()).toEqual([...titles].sort());
  expect(res.result?.data.every((row) => row.teamId === teamId)).toBe(true);
};

/**
 * Org A has two teams. teamA is the default team, so every org member is in it.
 * teamB was created with inheritMembers: false, so only people added directly are in it.
 *  - ownerA: org owner and teamA admin. Owns all the templates below.
 *  - memberA, managerA: member and manager of teamA. Not in teamB.
 *  - memberB: member of teamB, and also a member of teamA because teamA inherits.
 *  - teamA has four templates with the same suffix in the title, one per visibility:
 *    everyone, manager, admin (with a unique externalId and recipient email), and org.
 *
 * Org B is a separate org owned by "outsider". No overlap with Org A.
 *
 * So: memberB with a teamB header checks that teamA rows never come back.
 * memberA with a teamB header checks that non-members are rejected.
 */
const seedScenario = async () => {
  const { user: ownerA, organisation, team: teamA } = await seedUser();

  const teamBUrl = `team-b-${nanoid()}`;

  await createTeam({
    userId: ownerA.id,
    teamName: `Team B ${teamBUrl}`,
    teamUrl: teamBUrl,
    organisationId: organisation.id,
    inheritMembers: false,
  });

  const teamB = await prisma.team.findFirstOrThrow({ where: { url: teamBUrl } });

  const memberA = await seedTeamMember({ teamId: teamA.id, role: TeamMemberRole.MEMBER });
  const managerA = await seedTeamMember({ teamId: teamA.id, role: TeamMemberRole.MANAGER });
  const memberB = await seedTeamMember({ teamId: teamB.id, role: TeamMemberRole.MEMBER });

  const { user: outsider, team: outsiderTeam } = await seedUser();

  const suffix = nanoid();
  const hiddenRecipientEmail = `hidden-recipient-${suffix}@example.com`;

  const everyoneTemplate = await seedBlankTemplate(ownerA, teamA.id, {
    createTemplateOptions: {
      title: `Everyone Template ${suffix}`,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  const managerTemplate = await seedBlankTemplate(ownerA, teamA.id, {
    createTemplateOptions: {
      title: `Manager Template ${suffix}`,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  const adminTemplate = await seedBlankTemplate(ownerA, teamA.id, {
    createTemplateOptions: {
      title: `Admin Only Template ${suffix}`,
      externalId: `admin-external-${suffix}`,
      visibility: DocumentVisibility.ADMIN,
      recipients: {
        create: {
          email: hiddenRecipientEmail,
          name: `Hidden Recipient ${suffix}`,
          token: nanoid(),
        },
      },
    },
  });

  const orgTemplate = await seedBlankTemplate(ownerA, teamA.id, {
    createTemplateOptions: {
      title: `Org Template ${suffix}`,
      templateType: TemplateType.ORGANISATION,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  const allTitles = [everyoneTemplate.title, orgTemplate.title, managerTemplate.title, adminTemplate.title];

  // Which templates each role on teamA should see.
  const visibilityMatrix = [
    { caller: memberA, visible: [everyoneTemplate.title, orgTemplate.title] },
    { caller: managerA, visible: [everyoneTemplate.title, orgTemplate.title, managerTemplate.title] },
    { caller: ownerA, visible: allTitles },
  ];

  return {
    ownerA,
    memberA,
    managerA,
    memberB,
    teamA,
    teamB,
    outsider,
    outsiderTeam,
    suffix,
    everyoneTemplate,
    managerTemplate,
    adminTemplate,
    orgTemplate,
    hiddenRecipientEmail,
    allTitles,
    visibilityMatrix,
  };
};

// ─── Not logged in, or using a team header for a team you are not in ─────────

test.describe('Find Templates API - Adversarial: Auth and Team Header', () => {
  for (const procedure of FIND_TEMPLATE_PROCEDURES) {
    test(`${procedure}: should reject unauthenticated requests`, async ({ page }) => {
      const { teamA } = await seedScenario();

      const res = await trpcQuery(page, procedure, {}, teamA.id);

      expectRejected(res, 401);
    });

    test(`${procedure}: should reject a team header for a team the user is not in`, async ({ page }) => {
      const { memberA, teamA, teamB, outsider } = await seedScenario();

      const adminA = await seedTeamMember({ teamId: teamA.id, role: TeamMemberRole.ADMIN });

      const cases = [
        { name: 'org member, not in team', caller: memberA, teamId: teamB.id },
        { name: 'admin of another team', caller: adminA, teamId: teamB.id },
        { name: 'other organisation', caller: outsider, teamId: teamA.id },
        { name: 'no team header', caller: memberA, teamId: undefined },
      ];

      for (const { caller, teamId } of cases) {
        await apiSignin({ page, email: caller.email });

        const res = await trpcQuery(page, procedure, {}, teamId);

        expectRejected(res, 404);

        await apiSignout({ page });
      }
    });
  }

  test('findOrganisationTemplates: should reject a team header for a team in another org', async ({ page }) => {
    const { outsider, teamA } = await seedScenario();

    await apiSignin({ page, email: outsider.email });

    const res = await trpcQuery(page, 'template.findOrganisationTemplates', {}, teamA.id);

    expectRejected(res, 404);
  });
});

// ─── Search must not find templates you cannot see ──────────────────────────

test.describe('Find Templates API - Adversarial: Search', () => {
  for (const procedure of FIND_TEMPLATE_PROCEDURES) {
    test(`${procedure}: search must not find templates hidden by role`, async ({ page }) => {
      const { memberA, teamA, adminTemplate, hiddenRecipientEmail } = await seedScenario();

      await apiSignin({ page, email: memberA.email });

      for (const query of [adminTemplate.title, adminTemplate.externalId, hiddenRecipientEmail]) {
        const res = await trpcQuery(page, procedure, { query }, teamA.id);

        expectNoResults(res);
      }
    });

    test(`${procedure}: search must not find templates from another team`, async ({ page }) => {
      const { memberB, teamB, everyoneTemplate } = await seedScenario();

      await apiSignin({ page, email: memberB.email });

      const res = await trpcQuery(page, procedure, { query: everyoneTemplate.title }, teamB.id);

      expectNoResults(res);
    });

    test(`${procedure}: search must not find templates from another org`, async ({ page }) => {
      const { outsider, outsiderTeam, everyoneTemplate } = await seedScenario();

      await apiSignin({ page, email: outsider.email });

      const res = await trpcQuery(page, procedure, { query: everyoneTemplate.title }, outsiderTeam.id);

      expectNoResults(res);
    });

    test(`${procedure}: list and search show only what each role is allowed to see`, async ({ page }) => {
      const { teamA, suffix, allTitles, visibilityMatrix } = await seedScenario();

      for (const { caller, visible } of visibilityMatrix) {
        await apiSignin({ page, email: caller.email });

        const listRes = await trpcQuery(page, procedure, {}, teamA.id);

        expectExactTitles(listRes, visible, teamA.id);

        const searchRes = await trpcQuery(page, procedure, { query: suffix }, teamA.id);

        expectExactTitles(searchRes, visible, teamA.id);

        for (const hidden of allTitles.filter((title) => !visible.includes(title))) {
          const res = await trpcQuery(page, procedure, { query: hidden }, teamA.id);

          expectNoResults(res);
        }

        await apiSignout({ page });
      }
    });

    test(`${procedure}: wildcard search must not show more than allowed`, async ({ page }) => {
      const { memberA, teamA, everyoneTemplate, orgTemplate } = await seedScenario();

      await apiSignin({ page, email: memberA.email });

      // % and _ are not escaped, so these match everything you are allowed to see.
      for (const query of ['%', '_', '%%%']) {
        const res = await trpcQuery(page, procedure, { query }, teamA.id);

        expectExactTitles(res, [everyoneTemplate.title, orgTemplate.title], teamA.id);
      }

      for (const query of ['%Admin Only%', '%Manager%']) {
        const res = await trpcQuery(page, procedure, { query }, teamA.id);

        expectNoResults(res);
      }
    });
  }

  test('findOrganisationTemplates: search must not find templates from another org', async ({ page }) => {
    const { outsider, outsiderTeam, orgTemplate } = await seedScenario();

    await apiSignin({ page, email: outsider.email });

    const res = await trpcQuery(
      page,
      'template.findOrganisationTemplates',
      { query: orgTemplate.title },
      outsiderTeam.id,
    );

    expectNoResults(res);
  });

  test('findOrganisationTemplates: search must not find team templates from another team', async ({ page }) => {
    const { memberB, teamB, everyoneTemplate, managerTemplate, adminTemplate } = await seedScenario();

    await apiSignin({ page, email: memberB.email });

    for (const { title } of [everyoneTemplate, managerTemplate, adminTemplate]) {
      const res = await trpcQuery(page, 'template.findOrganisationTemplates', { query: title }, teamB.id);

      expectNoResults(res);
    }
  });

  test('findOrganisationTemplates: shows only what the user role on the requesting team allows', async ({ page }) => {
    const { ownerA, teamA, teamB, memberB, orgTemplate } = await seedScenario();

    const managerOrgTemplate = await seedBlankTemplate(ownerA, teamA.id, {
      createTemplateOptions: {
        title: `Manager Org Template ${nanoid()}`,
        templateType: TemplateType.ORGANISATION,
        visibility: DocumentVisibility.MANAGER_AND_ABOVE,
      },
    });

    const adminOrgTemplate = await seedBlankTemplate(ownerA, teamA.id, {
      createTemplateOptions: {
        title: `Admin Org Template ${nanoid()}`,
        templateType: TemplateType.ORGANISATION,
        visibility: DocumentVisibility.ADMIN,
      },
    });

    const managerB = await seedTeamMember({ teamId: teamB.id, role: TeamMemberRole.MANAGER });

    const allOrgTitles = [orgTemplate.title, managerOrgTemplate.title, adminOrgTemplate.title];

    const matrix = [
      { caller: memberB, visible: [orgTemplate.title] },
      { caller: managerB, visible: [orgTemplate.title, managerOrgTemplate.title] },
    ];

    for (const { caller, visible } of matrix) {
      await apiSignin({ page, email: caller.email });

      const listRes = await trpcQuery(page, 'template.findOrganisationTemplates', {}, teamB.id);

      expectExactTitles(listRes, visible, teamA.id);

      for (const hidden of allOrgTitles.filter((title) => !visible.includes(title))) {
        const res = await trpcQuery(page, 'template.findOrganisationTemplates', { query: hidden }, teamB.id);

        expectNoResults(res);
      }

      await apiSignout({ page });
    }
  });
});

// ─── Owner filter must not reach other teams or skip visibility checks ───────

test.describe('Find Templates API - Adversarial: Owner Filter', () => {
  const procedure = 'template.findTemplatesInternal';

  test('owner filter must not find templates from another team', async ({ page }) => {
    const { ownerA, memberB, teamB } = await seedScenario();

    await apiSignin({ page, email: memberB.email });

    const res = await trpcQuery(page, procedure, { ownerIds: [ownerA.id] }, teamB.id);

    expectNoResults(res);
  });

  test('owner filter must not find templates from another org', async ({ page }) => {
    const { ownerA, outsider, outsiderTeam } = await seedScenario();

    await apiSignin({ page, email: outsider.email });

    const res = await trpcQuery(page, procedure, { ownerIds: [ownerA.id] }, outsiderTeam.id);

    expectNoResults(res);
  });

  test('owning a template only makes it visible in its own team', async ({ page }) => {
    const { memberB, teamA, teamB } = await seedScenario();

    // memberB is in both teams and owns an admin-only template in each.
    // They can only see these because they own them. That must not cross teams.
    const ownedOnA = await seedBlankTemplate(memberB, teamA.id, {
      createTemplateOptions: { title: `Owned On A ${nanoid()}`, visibility: DocumentVisibility.ADMIN },
    });

    const ownedOnB = await seedBlankTemplate(memberB, teamB.id, {
      createTemplateOptions: { title: `Owned On B ${nanoid()}`, visibility: DocumentVisibility.ADMIN },
    });

    await apiSignin({ page, email: memberB.email });

    const inputs = [
      {},
      { ownerIds: [memberB.id] },
      { query: 'Owned On' },
      { ownerIds: [memberB.id], query: 'Owned On' },
    ];

    for (const input of inputs) {
      // teamB has no other templates, so this is the only row.
      const fromB = await trpcQuery(page, procedure, input, teamB.id);

      expectExactTitles(fromB, [ownedOnB.title], teamB.id);

      const fromA = await trpcQuery(page, procedure, input, teamA.id);

      expect(fromA.response.ok()).toBeTruthy();
      expect(titlesOf(fromA)).toContain(ownedOnA.title);
      expect(titlesOf(fromA)).not.toContain(ownedOnB.title);
    }
  });

  test('owner filter shows only what each role is allowed to see', async ({ page }) => {
    const { ownerA, teamA, suffix, allTitles, visibilityMatrix } = await seedScenario();

    const ownerIds = [ownerA.id];

    for (const { caller, visible } of visibilityMatrix) {
      await apiSignin({ page, email: caller.email });

      const listRes = await trpcQuery(page, procedure, { ownerIds }, teamA.id);

      expectExactTitles(listRes, visible, teamA.id);

      const searchRes = await trpcQuery(page, procedure, { ownerIds, query: suffix }, teamA.id);

      expectExactTitles(searchRes, visible, teamA.id);

      for (const hidden of allTitles.filter((title) => !visible.includes(title))) {
        const res = await trpcQuery(page, procedure, { ownerIds, query: hidden }, teamA.id);

        expectNoResults(res);
      }

      await apiSignout({ page });
    }
  });

  test('owner filter with unknown user ids returns nothing', async ({ page }) => {
    const { ownerA, teamA } = await seedScenario();

    await apiSignin({ page, email: ownerA.email });

    const res = await trpcQuery(page, procedure, { ownerIds: [-1, 999999999] }, teamA.id);

    expectNoResults(res);
  });

  test('owner filter is ignored by the public findTemplates route', async ({ page }) => {
    const { ownerA, memberA, teamA, everyoneTemplate, orgTemplate } = await seedScenario();

    await apiSignin({ page, email: memberA.email });

    // The public route does not accept ownerIds. It should be dropped, not error.
    const res = await trpcQuery(page, 'template.findTemplates', { ownerIds: [ownerA.id] }, teamA.id);

    expectExactTitles(res, [everyoneTemplate.title, orgTemplate.title], teamA.id);
  });
});

// ─── Folder filter must not reach other teams ────────────────────────────────

test.describe('Find Templates API - Adversarial: Folder Filter', () => {
  for (const procedure of FIND_TEMPLATE_PROCEDURES) {
    test(`${procedure}: folder filter must not find folders from another team`, async ({ page }) => {
      const { ownerA, teamA, memberB, teamB } = await seedScenario();

      const folderA = await seedBlankFolder(ownerA, teamA.id, {
        createFolderOptions: { type: FolderType.TEMPLATE },
      });

      await seedBlankTemplate(ownerA, teamA.id, {
        createTemplateOptions: {
          title: `Foldered Template ${nanoid()}`,
          visibility: DocumentVisibility.EVERYONE,
          folderId: folderA.id,
        },
      });

      await apiSignin({ page, email: memberB.email });

      const res = await trpcQuery(page, procedure, { folderId: folderA.id }, teamB.id);

      expectNoResults(res);
    });
  }
});
