import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { prisma } from '@documenso/prisma';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DocumentVisibility, FolderType, TeamMemberRole, TemplateType } from '@prisma/client';
import { customAlphabet } from 'nanoid';

import { apiSignin } from '../fixtures/authentication';

const nanoid = customAlphabet('1234567890abcdef', 10);

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

type FindTemplatesResult = {
  data: Array<{ title: string; userId: number; teamId: number }>;
  count: number;
};

/**
 * Calls a tRPC query directly, bypassing the UI, optionally spoofing the
 * `x-team-id` header.
 */
const trpcQuery = async (page: Page, procedure: string, input: Record<string, unknown>, teamId?: number) => {
  const inputParam = encodeURIComponent(JSON.stringify({ json: input }));
  const url = `${WEBAPP_BASE_URL}/api/trpc/${procedure}?input=${inputParam}`;

  const headers: Record<string, string> = {};

  if (teamId) {
    headers['x-team-id'] = teamId.toString();
  }

  const res = await page.context().request.get(url, { headers });

  const json = res.ok() ? await res.json() : null;
  const result: FindTemplatesResult | null = json ? json.result.data.json : null;

  return { res, result };
};

const FIND_TEMPLATE_PROCEDURES = ['template.findTemplates', 'template.findTemplatesInternal'] as const;

/**
 * Two organisations:
 *
 * Org A
 *  - ownerA: org owner, ADMIN on teamA.
 *  - teamA: the default team, inherits organisation members.
 *  - teamB: sibling team created with `inheritMembers: false`.
 *  - memberA: MEMBER on teamA. Not a member of teamB.
 *  - memberB: MEMBER on teamB, and (via inheritance) also a MEMBER of teamA.
 *  - teamA has an EVERYONE template, an ADMIN-only template with a unique
 *    recipient email, and an ORGANISATION template.
 *
 * Because memberB legitimately belongs to both teams, the "sibling team"
 * cases below exercise `x-team-id` scoping (a teamB request must never
 * return teamA rows), while memberA -> teamB exercises non-membership.
 *
 * Org B
 *  - outsider: owner of an unrelated organisation and team.
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

  const teamB = await prisma.team.findFirstOrThrow({
    where: { url: teamBUrl },
  });

  const memberA = await seedTeamMember({
    teamId: teamA.id,
    role: TeamMemberRole.MEMBER,
  });

  const memberB = await seedTeamMember({
    teamId: teamB.id,
    role: TeamMemberRole.MEMBER,
  });

  const { user: outsider, team: outsiderTeam } = await seedUser();

  const suffix = nanoid();

  const hiddenRecipientEmail = `hidden-recipient-${suffix}@example.com`;

  const everyoneTemplate = await seedBlankTemplate(ownerA, teamA.id, {
    createTemplateOptions: {
      title: `Everyone Template ${suffix}`,
      visibility: DocumentVisibility.EVERYONE,
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

  return {
    ownerA,
    memberA,
    memberB,
    teamA,
    teamB,
    outsider,
    outsiderTeam,
    everyoneTemplate,
    adminTemplate,
    orgTemplate,
    hiddenRecipientEmail,
  };
};

const titlesOf = (result: FindTemplatesResult | null) => (result?.data ?? []).map((row) => row.title);

// ─── Unauthenticated and spoofed x-team-id requests ──────────────────────────

test.describe('Find Templates API - Adversarial: Authentication and x-team-id Header Spoofing', () => {
  for (const procedure of FIND_TEMPLATE_PROCEDURES) {
    test(`${procedure}: should reject unauthenticated requests`, async ({ page }) => {
      const { teamA } = await seedScenario();

      const { res } = await trpcQuery(page, procedure, { page: 1, perPage: 50 }, teamA.id);

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(401);
    });

    test(`${procedure}: should reject a spoofed x-team-id for a sibling team the user is not in`, async ({ page }) => {
      const { memberA, teamB } = await seedScenario();

      await apiSignin({ page, email: memberA.email });

      // teamB does not inherit organisation members, so memberA (teamA only)
      // has no membership there and must be rejected despite being in the org.
      const { res, result } = await trpcQuery(page, procedure, { page: 1, perPage: 50 }, teamB.id);

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
      expect(result).toBeNull();
    });

    test(`${procedure}: should reject an ADMIN of another team spoofing x-team-id`, async ({ page }) => {
      const { teamA, teamB } = await seedScenario();

      // A team ADMIN role must not carry over to a team the user is not in.
      const adminA = await seedTeamMember({
        teamId: teamA.id,
        role: TeamMemberRole.ADMIN,
      });

      await apiSignin({ page, email: adminA.email });

      const { res, result } = await trpcQuery(page, procedure, { page: 1, perPage: 50 }, teamB.id);

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
      expect(result).toBeNull();
    });

    test(`${procedure}: should reject a spoofed x-team-id for a team in another organisation`, async ({ page }) => {
      const { outsider, teamA } = await seedScenario();

      await apiSignin({ page, email: outsider.email });

      const { res, result } = await trpcQuery(page, procedure, { page: 1, perPage: 50 }, teamA.id);

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
      expect(result).toBeNull();
    });

    test(`${procedure}: should reject a request with no team header`, async ({ page }) => {
      const { memberA } = await seedScenario();

      await apiSignin({ page, email: memberA.email });

      const { res, result } = await trpcQuery(page, procedure, { page: 1, perPage: 50 });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
      expect(result).toBeNull();
    });
  }

  test('findOrganisationTemplates: should reject a spoofed x-team-id for a team in another organisation', async ({
    page,
  }) => {
    const { outsider, teamA } = await seedScenario();

    await apiSignin({ page, email: outsider.email });

    const { res, result } = await trpcQuery(
      page,
      'template.findOrganisationTemplates',
      { page: 1, perPage: 50 },
      teamA.id,
    );

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
    expect(result).toBeNull();
  });
});

// ─── Search query: must not reveal hidden templates (even via count) ─────────

test.describe('Find Templates API - Adversarial: Search Query Leakage', () => {
  for (const procedure of FIND_TEMPLATE_PROCEDURES) {
    test(`${procedure}: query must not reveal templates hidden by role visibility`, async ({ page }) => {
      const { memberA, teamA, adminTemplate, hiddenRecipientEmail } = await seedScenario();

      await apiSignin({ page, email: memberA.email });

      // Exact title.
      const byTitle = await trpcQuery(page, procedure, { query: adminTemplate.title, page: 1, perPage: 50 }, teamA.id);

      expect(byTitle.res.ok()).toBeTruthy();
      expect(byTitle.result?.count).toBe(0);
      expect(titlesOf(byTitle.result)).not.toContain(adminTemplate.title);

      // External ID.
      const byExternalId = await trpcQuery(
        page,
        procedure,
        { query: adminTemplate.externalId, page: 1, perPage: 50 },
        teamA.id,
      );

      expect(byExternalId.result?.count).toBe(0);

      // Recipient email.
      const byRecipient = await trpcQuery(
        page,
        procedure,
        { query: hiddenRecipientEmail, page: 1, perPage: 50 },
        teamA.id,
      );

      expect(byRecipient.result?.count).toBe(0);
    });

    test(`${procedure}: query must not reveal templates from a sibling team`, async ({ page }) => {
      const { memberB, teamB, everyoneTemplate } = await seedScenario();

      await apiSignin({ page, email: memberB.email });

      const { res, result } = await trpcQuery(
        page,
        procedure,
        { query: everyoneTemplate.title, page: 1, perPage: 50 },
        teamB.id,
      );

      expect(res.ok()).toBeTruthy();
      expect(result?.count).toBe(0);
      expect(titlesOf(result)).not.toContain(everyoneTemplate.title);
    });

    test(`${procedure}: query must not reveal templates from another organisation`, async ({ page }) => {
      const { outsider, outsiderTeam, everyoneTemplate } = await seedScenario();

      await apiSignin({ page, email: outsider.email });

      const { res, result } = await trpcQuery(
        page,
        procedure,
        { query: everyoneTemplate.title, page: 1, perPage: 50 },
        outsiderTeam.id,
      );

      expect(res.ok()).toBeTruthy();
      expect(result?.count).toBe(0);
    });

    test(`${procedure}: query still returns templates the user is allowed to see`, async ({ page }) => {
      const { memberA, teamA, everyoneTemplate, adminTemplate, orgTemplate } = await seedScenario();

      await apiSignin({ page, email: memberA.email });

      // All three teamA templates share this suffix; only the two visible to a
      // MEMBER should match, and the count must not leak the hidden one.
      const suffix = everyoneTemplate.title.split(' ').pop();

      const { res, result } = await trpcQuery(page, procedure, { query: suffix, page: 1, perPage: 50 }, teamA.id);

      expect(res.ok()).toBeTruthy();
      expect(result?.count).toBe(2);
      expect(titlesOf(result)).toContain(everyoneTemplate.title);
      expect(titlesOf(result)).toContain(orgTemplate.title);
      expect(titlesOf(result)).not.toContain(adminTemplate.title);
    });

    test(`${procedure}: LIKE wildcard queries must not widen visibility`, async ({ page }) => {
      const { memberA, teamA, adminTemplate } = await seedScenario();

      await apiSignin({ page, email: memberA.email });

      // `%` and `_` are passed through to ILIKE, so these are the widest
      // possible queries. They may match everything visible, but never more.
      for (const query of ['%', '_', '%%%']) {
        const { res, result } = await trpcQuery(page, procedure, { query, page: 1, perPage: 50 }, teamA.id);

        expect(res.ok()).toBeTruthy();
        expect(result?.count).toBe(2);
        expect(titlesOf(result)).not.toContain(adminTemplate.title);
        expect(result?.data.every((row) => row.teamId === teamA.id)).toBe(true);
      }

      // A wildcard-wrapped fragment of the hidden title must still find nothing.
      const { result } = await trpcQuery(page, procedure, { query: '%Admin Only%', page: 1, perPage: 50 }, teamA.id);

      expect(result?.count).toBe(0);
    });
  }

  test('findOrganisationTemplates: query must not reveal org templates from another organisation', async ({ page }) => {
    const { outsider, outsiderTeam, orgTemplate } = await seedScenario();

    await apiSignin({ page, email: outsider.email });

    const { res, result } = await trpcQuery(
      page,
      'template.findOrganisationTemplates',
      { query: orgTemplate.title, page: 1, perPage: 50 },
      outsiderTeam.id,
    );

    expect(res.ok()).toBeTruthy();
    expect(result?.count).toBe(0);
  });

  test('findOrganisationTemplates: query must not reveal non-org templates from a sibling team', async ({ page }) => {
    const { memberB, teamB, everyoneTemplate, adminTemplate } = await seedScenario();

    await apiSignin({ page, email: memberB.email });

    for (const template of [everyoneTemplate, adminTemplate]) {
      const { res, result } = await trpcQuery(
        page,
        'template.findOrganisationTemplates',
        { query: template.title, page: 1, perPage: 50 },
        teamB.id,
      );

      expect(res.ok()).toBeTruthy();
      expect(result?.count).toBe(0);
    }
  });

  test('findOrganisationTemplates: query must not reveal admin-only org templates to a member', async ({ page }) => {
    const { ownerA, teamA, memberB, teamB } = await seedScenario();

    const adminOrgTemplate = await seedBlankTemplate(ownerA, teamA.id, {
      createTemplateOptions: {
        title: `Admin Org Template ${nanoid()}`,
        templateType: TemplateType.ORGANISATION,
        visibility: DocumentVisibility.ADMIN,
      },
    });

    await apiSignin({ page, email: memberB.email });

    const { res, result } = await trpcQuery(
      page,
      'template.findOrganisationTemplates',
      { query: adminOrgTemplate.title, page: 1, perPage: 50 },
      teamB.id,
    );

    expect(res.ok()).toBeTruthy();
    expect(result?.count).toBe(0);
  });
});

// ─── ownerIds: must not reach other teams or bypass visibility ───────────────

test.describe('Find Templates API - Adversarial: Cross-Team ownerIds', () => {
  test('ownerIds must not reveal templates owned by a user in a sibling team', async ({ page }) => {
    const { ownerA, memberB, teamB, everyoneTemplate } = await seedScenario();

    await apiSignin({ page, email: memberB.email });

    // memberB (teamB) asks for everything owned by ownerA, whose templates live on teamA.
    const { res, result } = await trpcQuery(
      page,
      'template.findTemplatesInternal',
      { ownerIds: [ownerA.id], page: 1, perPage: 50 },
      teamB.id,
    );

    expect(res.ok()).toBeTruthy();
    expect(result?.count).toBe(0);
    expect(titlesOf(result)).not.toContain(everyoneTemplate.title);
  });

  test('ownerIds must not reveal templates owned by a user in another organisation', async ({ page }) => {
    const { ownerA, outsider, outsiderTeam, everyoneTemplate } = await seedScenario();

    await apiSignin({ page, email: outsider.email });

    const { res, result } = await trpcQuery(
      page,
      'template.findTemplatesInternal',
      { ownerIds: [ownerA.id], page: 1, perPage: 50 },
      outsiderTeam.id,
    );

    expect(res.ok()).toBeTruthy();
    expect(result?.count).toBe(0);
    expect(titlesOf(result)).not.toContain(everyoneTemplate.title);
  });

  test('ownerIds must not bypass role visibility within the team', async ({ page }) => {
    const { ownerA, memberA, teamA, everyoneTemplate, adminTemplate } = await seedScenario();

    await apiSignin({ page, email: memberA.email });

    // memberA is a MEMBER; filtering by the admin owner must still hide ADMIN-only templates.
    const { res, result } = await trpcQuery(
      page,
      'template.findTemplatesInternal',
      { ownerIds: [ownerA.id], page: 1, perPage: 50 },
      teamA.id,
    );

    expect(res.ok()).toBeTruthy();
    expect(titlesOf(result)).toContain(everyoneTemplate.title);
    expect(titlesOf(result)).not.toContain(adminTemplate.title);
    expect(result?.data.every((row) => row.teamId === teamA.id)).toBe(true);
  });

  test('ownerIds combined with query must not bypass role visibility', async ({ page }) => {
    const { ownerA, memberA, teamA, adminTemplate } = await seedScenario();

    await apiSignin({ page, email: memberA.email });

    const { res, result } = await trpcQuery(
      page,
      'template.findTemplatesInternal',
      { ownerIds: [ownerA.id], query: adminTemplate.title, page: 1, perPage: 50 },
      teamA.id,
    );

    expect(res.ok()).toBeTruthy();
    expect(result?.count).toBe(0);
  });

  test('ownerIds with unknown user IDs returns nothing rather than everything', async ({ page }) => {
    const { ownerA, teamA } = await seedScenario();

    await apiSignin({ page, email: ownerA.email });

    const { res, result } = await trpcQuery(
      page,
      'template.findTemplatesInternal',
      { ownerIds: [-1, 999999999], page: 1, perPage: 50 },
      teamA.id,
    );

    expect(res.ok()).toBeTruthy();
    expect(result?.count).toBe(0);
  });

  test('ownerIds is ignored by the public findTemplates route', async ({ page }) => {
    const { ownerA, memberA, teamA, everyoneTemplate } = await seedScenario();

    await apiSignin({ page, email: memberA.email });

    // Passing ownerIds to the public route must not error or filter, since
    // the field is not part of its contract.
    const { res, result } = await trpcQuery(
      page,
      'template.findTemplates',
      { ownerIds: [ownerA.id], page: 1, perPage: 50 },
      teamA.id,
    );

    expect(res.ok()).toBeTruthy();
    expect(titlesOf(result)).toContain(everyoneTemplate.title);
  });
});

// ─── folderId: must not reach other teams ────────────────────────────────────

test.describe('Find Templates API - Adversarial: Cross-Team folderId', () => {
  for (const procedure of FIND_TEMPLATE_PROCEDURES) {
    test(`${procedure}: folderId from a sibling team must not reveal that folder's templates`, async ({ page }) => {
      const { ownerA, teamA, memberB, teamB } = await seedScenario();

      const folderA = await seedBlankFolder(ownerA, teamA.id, {
        createFolderOptions: { type: FolderType.TEMPLATE },
      });

      const folderedTemplate = await seedBlankTemplate(ownerA, teamA.id, {
        createTemplateOptions: {
          title: `Foldered Template ${nanoid()}`,
          visibility: DocumentVisibility.EVERYONE,
          folderId: folderA.id,
        },
      });

      await apiSignin({ page, email: memberB.email });

      const { res, result } = await trpcQuery(
        page,
        procedure,
        { folderId: folderA.id, page: 1, perPage: 50 },
        teamB.id,
      );

      expect(res.ok()).toBeTruthy();
      expect(result?.count).toBe(0);
      expect(titlesOf(result)).not.toContain(folderedTemplate.title);
    });
  }
});
