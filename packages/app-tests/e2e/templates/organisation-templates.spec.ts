import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { TemplateType } from '@prisma/client';
import { customAlphabet } from 'nanoid';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin, apiSignout } from '../fixtures/authentication';

const nanoid = customAlphabet('1234567890abcdef', 10);

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

/**
 * Helper to set up the standard two-team-one-org scenario:
 *
 * - One organisation with two teams (teamA and teamB).
 * - ownerA owns both the org and teamA.
 * - memberB is only a member of teamB (no relation to teamA).
 * - An ORGANISATION template is created on teamA.
 */
const seedOrgTemplateScenario = async () => {
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

  // memberB is only added to teamB, not teamA.
  const memberB = await seedTeamMember({
    teamId: teamB.id,
    role: 'MEMBER',
  });

  const orgTemplate = await seedBlankTemplate(ownerA, teamA.id, {
    createTemplateOptions: {
      title: `Org Template ${nanoid()}`,
      templateType: TemplateType.ORGANISATION,
    },
  });

  return { ownerA, organisation, teamA, teamB, memberB, orgTemplate };
};

/**
 * Helper to make tRPC queries via the authenticated page context.
 */
const trpcQuery = async (
  page: Page,
  procedure: string,
  input: Record<string, unknown>,
  teamId?: number,
) => {
  const inputParam = encodeURIComponent(JSON.stringify({ json: input }));
  const url = `${WEBAPP_BASE_URL}/api/trpc/${procedure}?input=${inputParam}`;

  const headers: Record<string, string> = {};

  if (teamId) {
    headers['x-team-id'] = teamId.toString();
  }

  const res = await page.context().request.get(url, { headers });

  return { res, json: res.ok() ? await res.json() : null };
};

const trpcMutation = async (
  page: Page,
  procedure: string,
  input: Record<string, unknown>,
  teamId?: number,
) => {
  const url = `${WEBAPP_BASE_URL}/api/trpc/${procedure}`;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (teamId) {
    headers['x-team-id'] = teamId.toString();
  }

  const res = await page.context().request.post(url, {
    data: JSON.stringify({ json: input }),
    headers,
  });

  return { res, json: res.ok() ? await res.json() : null };
};

// ─── UI: Tab Visibility ──────────────────────────────────────────────────────

test.describe('Organisation Templates - UI Tabs', () => {
  test('should show Team/Organisation tabs for non-personal orgs', async ({ page }) => {
    const { ownerA, teamA } = await seedOrgTemplateScenario();

    await apiSignin({
      page,
      email: ownerA.email,
      redirectPath: `/t/${teamA.url}/templates`,
    });

    await expect(page.getByTestId('template-tab-team')).toBeVisible();
    await expect(page.getByTestId('template-tab-organisation')).toBeVisible();
  });

  test('should not show tabs for personal organisations', async ({ page }) => {
    const { user, team } = await seedUser({ isPersonalOrganisation: true });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/templates`,
    });

    await expect(page.getByTestId('template-tab-team')).not.toBeVisible();
    await expect(page.getByTestId('template-tab-organisation')).not.toBeVisible();
  });
});

// ─── UI: Listing Organisation Templates ──────────────────────────────────────

test.describe('Organisation Templates - Listing', () => {
  test('should list org templates from other teams under the Organisation tab', async ({
    page,
  }) => {
    const { memberB, teamB, orgTemplate } = await seedOrgTemplateScenario();

    await apiSignin({
      page,
      email: memberB.email,
      redirectPath: `/t/${teamB.url}/templates`,
    });

    // Team tab should show 0 (memberB has no templates on teamB).
    await expect(page.getByTestId('template-tab-team')).toBeVisible();

    // Switch to Organisation tab.
    await page.getByTestId('template-tab-organisation').click();

    // Should see the org template from teamA.
    await expect(page.getByText(orgTemplate.title)).toBeVisible();
  });

  test('should not show private templates from other teams under Organisation tab', async ({
    page,
  }) => {
    const { ownerA, teamA, memberB, teamB } = await seedOrgTemplateScenario();

    // Create a private template on teamA — should NOT appear in org tab.
    const privateTemplate = await seedBlankTemplate(ownerA, teamA.id, {
      createTemplateOptions: {
        title: `Private Template ${nanoid()}`,
        templateType: TemplateType.PRIVATE,
      },
    });

    await apiSignin({
      page,
      email: memberB.email,
      redirectPath: `/t/${teamB.url}/templates?view=organisation`,
    });

    await expect(page.getByText(privateTemplate.title)).not.toBeVisible();
  });
});

// ─── UI: Organisation Template Detail Page ───────────────────────────────────

test.describe('Organisation Templates - Detail Page', () => {
  test('should show org template detail but hide edit/delete actions', async ({ page }) => {
    const { memberB, teamB, orgTemplate } = await seedOrgTemplateScenario();

    await apiSignin({
      page,
      email: memberB.email,
      redirectPath: `/t/${teamB.url}/templates?view=organisation`,
    });

    // Click into the org template.
    await page.getByText(orgTemplate.title).click();

    // Should see the template title.
    await expect(page.getByRole('heading', { name: orgTemplate.title })).toBeVisible();

    // Should see the Use button.
    await expect(page.getByRole('button', { name: 'Use' })).toBeVisible();

    // Should NOT see the Edit Template button.
    await expect(page.getByRole('link', { name: 'Edit Template' })).not.toBeVisible();
  });
});

// ─── API: findOrganisationTemplates ──────────────────────────────────────────

test.describe('Organisation Templates - findOrganisationTemplates API', () => {
  test('should return org templates for a member of a sibling team', async ({ page }) => {
    const { memberB, teamB, orgTemplate } = await seedOrgTemplateScenario();

    await apiSignin({ page, email: memberB.email });

    const { res, json } = await trpcQuery(
      page,
      'template.findOrganisationTemplates',
      { page: 1, perPage: 50 },
      teamB.id,
    );

    expect(res.ok()).toBeTruthy();

    const titles = json.result.data.json.data.map((t: { title: string }) => t.title);
    expect(titles).toContain(orgTemplate.title);
  });

  test('should not return private templates from sibling teams', async ({ page }) => {
    const { ownerA, teamA, memberB, teamB } = await seedOrgTemplateScenario();

    const privateTemplate = await seedBlankTemplate(ownerA, teamA.id, {
      createTemplateOptions: {
        title: `Private No Show ${nanoid()}`,
        templateType: TemplateType.PRIVATE,
      },
    });

    await apiSignin({ page, email: memberB.email });

    const { json } = await trpcQuery(
      page,
      'template.findOrganisationTemplates',
      { page: 1, perPage: 50 },
      teamB.id,
    );

    const titles = json.result.data.json.data.map((t: { title: string }) => t.title);
    expect(titles).not.toContain(privateTemplate.title);
  });

  test('should not return org templates to a user outside the organisation', async ({ page }) => {
    const { orgTemplate } = await seedOrgTemplateScenario();

    // Create a completely separate user with their own org.
    const { user: outsider, team: outsiderTeam } = await seedUser();

    await apiSignin({ page, email: outsider.email });

    const { json } = await trpcQuery(
      page,
      'template.findOrganisationTemplates',
      { page: 1, perPage: 50 },
      outsiderTeam.id,
    );

    const titles = json.result.data.json.data.map((t: { title: string }) => t.title);
    expect(titles).not.toContain(orgTemplate.title);
  });

  test('should respect document visibility based on the viewer team role', async ({ page }) => {
    const { ownerA, teamA, memberB, teamB } = await seedOrgTemplateScenario();

    const everyoneTemplate = await seedBlankTemplate(ownerA, teamA.id, {
      createTemplateOptions: {
        title: `Visibility Everyone ${nanoid()}`,
        templateType: TemplateType.ORGANISATION,
        visibility: 'EVERYONE',
      },
    });

    const adminOnlyTemplate = await seedBlankTemplate(ownerA, teamA.id, {
      createTemplateOptions: {
        title: `Visibility Admin ${nanoid()}`,
        templateType: TemplateType.ORGANISATION,
        visibility: 'ADMIN',
      },
    });

    // memberB has role MEMBER on teamB — should only see EVERYONE visibility.
    await apiSignin({ page, email: memberB.email });

    const { json } = await trpcQuery(
      page,
      'template.findOrganisationTemplates',
      { page: 1, perPage: 50 },
      teamB.id,
    );

    const titles = json.result.data.json.data.map((t: { title: string }) => t.title);
    expect(titles).toContain(everyoneTemplate.title);
    expect(titles).not.toContain(adminOnlyTemplate.title);

    await apiSignout({ page });

    // ownerA has role ADMIN on teamA — should see both.
    await apiSignin({ page, email: ownerA.email });

    const { json: adminJson } = await trpcQuery(
      page,
      'template.findOrganisationTemplates',
      { page: 1, perPage: 50 },
      teamA.id,
    );

    const adminTitles = adminJson.result.data.json.data.map((t: { title: string }) => t.title);
    expect(adminTitles).toContain(everyoneTemplate.title);
    expect(adminTitles).toContain(adminOnlyTemplate.title);
  });
});

// ─── API: getOrganisationTemplateById ────────────────────────────────────────

test.describe('Organisation Templates - getOrganisationTemplateById API', () => {
  test('should allow a sibling team member to fetch an org template', async ({ page }) => {
    const { memberB, teamB, orgTemplate } = await seedOrgTemplateScenario();

    await apiSignin({ page, email: memberB.email });

    const { res, json } = await trpcQuery(
      page,
      'template.getOrganisationTemplateById',
      { envelopeId: orgTemplate.id },
      teamB.id,
    );

    expect(res.ok()).toBeTruthy();
    expect(json.result.data.json.title).toBe(orgTemplate.title);
  });

  test('should reject access from a user outside the organisation', async ({ page }) => {
    const { orgTemplate } = await seedOrgTemplateScenario();
    const { user: outsider, team: outsiderTeam } = await seedUser();

    await apiSignin({ page, email: outsider.email });

    const { res } = await trpcQuery(
      page,
      'template.getOrganisationTemplateById',
      { envelopeId: orgTemplate.id },
      outsiderTeam.id,
    );

    // Should fail — outsider is not in the same org.
    expect(res.ok()).toBeFalsy();
  });

  test('should reject fetching a private template via the org endpoint', async ({ page }) => {
    const { ownerA, teamA, memberB, teamB } = await seedOrgTemplateScenario();

    const privateTemplate = await seedBlankTemplate(ownerA, teamA.id, {
      createTemplateOptions: {
        title: `Private ${nanoid()}`,
        templateType: TemplateType.PRIVATE,
      },
    });

    await apiSignin({ page, email: memberB.email });

    const { res } = await trpcQuery(
      page,
      'template.getOrganisationTemplateById',
      { envelopeId: privateTemplate.id },
      teamB.id,
    );

    // Should fail — template is PRIVATE, not ORGANISATION.
    expect(res.ok()).toBeFalsy();
  });
});

// ─── API: createDocumentFromTemplate with org template ───────────────────────

test.describe('Organisation Templates - Use from different team', () => {
  test('should allow creating a document from an org template owned by a sibling team', async ({
    page,
  }) => {
    const { memberB, teamB, orgTemplate } = await seedOrgTemplateScenario();

    // Add a recipient to the org template so we can use it.
    await prisma.recipient.create({
      data: {
        email: 'recipient@test.documenso.com',
        name: 'Recipient',
        token: Math.random().toString().slice(2, 7),
        envelopeId: orgTemplate.id,
      },
    });

    const orgTemplateWithRecipients = await prisma.envelope.findFirstOrThrow({
      where: { id: orgTemplate.id },
      include: { recipients: true },
    });

    await apiSignin({ page, email: memberB.email });

    const templateId = mapSecondaryIdToTemplateId(orgTemplateWithRecipients.secondaryId);

    const { res } = await trpcMutation(
      page,
      'template.createDocumentFromTemplate',
      {
        templateId,
        recipients: orgTemplateWithRecipients.recipients.map((r) => ({
          id: r.id,
          email: r.email,
          name: r.name ?? '',
        })),
      },
      teamB.id,
    );

    expect(res.ok()).toBeTruthy();
  });
});

// ─── Adversarial: Cross-organisation access ──────────────────────────────────

test.describe('Organisation Templates - Adversarial', () => {
  test('should not allow accessing org template from a different organisation via getEnvelopeById', async ({
    page,
  }) => {
    const { orgTemplate } = await seedOrgTemplateScenario();
    const { user: outsider, team: outsiderTeam } = await seedUser();

    await apiSignin({ page, email: outsider.email });

    // Try to fetch via the standard envelope.get endpoint.
    const { res } = await trpcQuery(
      page,
      'envelope.get',
      { envelopeId: orgTemplate.id },
      outsiderTeam.id,
    );

    expect(res.ok()).toBeFalsy();
  });

  test('should not allow a sibling team member to fetch a private template via org endpoint', async ({
    page,
  }) => {
    const { ownerA, teamA, memberB, teamB } = await seedOrgTemplateScenario();

    const privateTemplate = await seedBlankTemplate(ownerA, teamA.id, {
      createTemplateOptions: {
        title: `Adversarial Private ${nanoid()}`,
        templateType: TemplateType.PRIVATE,
      },
    });

    await apiSignin({ page, email: memberB.email });

    // Attempt 1: Try via org template endpoint.
    const { res: orgRes } = await trpcQuery(
      page,
      'template.getOrganisationTemplateById',
      { envelopeId: privateTemplate.id },
      teamB.id,
    );
    expect(orgRes.ok()).toBeFalsy();

    // Attempt 2: Try via standard envelope endpoint.
    const { res: envelopeRes } = await trpcQuery(
      page,
      'envelope.get',
      { envelopeId: privateTemplate.id },
      teamB.id,
    );
    expect(envelopeRes.ok()).toBeFalsy();
  });

  test('should not list org templates from a completely unrelated organisation', async ({
    page,
  }) => {
    // Create scenario A.
    const { orgTemplate: orgTemplateA } = await seedOrgTemplateScenario();

    // Create scenario B (separate org, separate teams).
    const { memberB: memberFromOrgB, teamB: teamFromOrgB } = await seedOrgTemplateScenario();

    await apiSignin({ page, email: memberFromOrgB.email });

    const { json } = await trpcQuery(
      page,
      'template.findOrganisationTemplates',
      { page: 1, perPage: 50 },
      teamFromOrgB.id,
    );

    const titles = json.result.data.json.data.map((t: { title: string }) => t.title);
    expect(titles).not.toContain(orgTemplateA.title);
  });

  test('should not allow unauthenticated access to org template endpoints', async ({ page }) => {
    const { orgTemplate, teamB } = await seedOrgTemplateScenario();

    // No apiSignin — unauthenticated.

    const { res: findRes } = await trpcQuery(
      page,
      'template.findOrganisationTemplates',
      { page: 1, perPage: 50 },
      teamB.id,
    );
    expect(findRes.ok()).toBeFalsy();
    expect(findRes.status()).toBe(401);

    const { res: getRes } = await trpcQuery(
      page,
      'template.getOrganisationTemplateById',
      { envelopeId: orgTemplate.id },
      teamB.id,
    );
    expect(getRes.ok()).toBeFalsy();
    expect(getRes.status()).toBe(401);
  });

  test('should not return org template data via findTemplates (team endpoint)', async ({
    page,
  }) => {
    const { memberB, teamB, orgTemplate } = await seedOrgTemplateScenario();

    await apiSignin({ page, email: memberB.email });

    // The standard findTemplates endpoint should NOT include org templates from other teams.
    const { json } = await trpcQuery(
      page,
      'template.findTemplates',
      { page: 1, perPage: 50 },
      teamB.id,
    );

    const titles = json.result.data.json.data.map((t: { title: string }) => t.title);
    expect(titles).not.toContain(orgTemplate.title);
  });
});

// ─── API: envelope.item.getManyByToken (org template fallback) ───────────────

test.describe('Organisation Templates - envelope.item.getManyByToken API', () => {
  test('should allow a sibling team member to fetch envelope items for an org template', async ({
    page,
  }) => {
    const { memberB, teamB, orgTemplate } = await seedOrgTemplateScenario();

    await apiSignin({ page, email: memberB.email });

    const { res, json } = await trpcQuery(
      page,
      'envelope.item.getManyByToken',
      { envelopeId: orgTemplate.id, access: { type: 'user' } },
      teamB.id,
    );

    expect(res.ok()).toBeTruthy();

    const items = json.result.data.json.data;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].envelopeId).toBe(orgTemplate.id);
  });

  test('should allow the owning team member to fetch envelope items (own-team path)', async ({
    page,
  }) => {
    const { ownerA, teamA, orgTemplate } = await seedOrgTemplateScenario();

    await apiSignin({ page, email: ownerA.email });

    const { res, json } = await trpcQuery(
      page,
      'envelope.item.getManyByToken',
      { envelopeId: orgTemplate.id, access: { type: 'user' } },
      teamA.id,
    );

    expect(res.ok()).toBeTruthy();

    const items = json.result.data.json.data;
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].envelopeId).toBe(orgTemplate.id);
  });

  test('should reject a user outside the organisation', async ({ page }) => {
    const { orgTemplate } = await seedOrgTemplateScenario();
    const { user: outsider, team: outsiderTeam } = await seedUser();

    await apiSignin({ page, email: outsider.email });

    const { res } = await trpcQuery(
      page,
      'envelope.item.getManyByToken',
      { envelopeId: orgTemplate.id, access: { type: 'user' } },
      outsiderTeam.id,
    );

    expect(res.ok()).toBeFalsy();
  });

  test('should reject fetching items for a PRIVATE template from a sibling team', async ({
    page,
  }) => {
    const { ownerA, teamA, memberB, teamB } = await seedOrgTemplateScenario();

    const privateTemplate = await seedBlankTemplate(ownerA, teamA.id, {
      createTemplateOptions: {
        title: `Private Items ${nanoid()}`,
        templateType: TemplateType.PRIVATE,
      },
    });

    await apiSignin({ page, email: memberB.email });

    const { res } = await trpcQuery(
      page,
      'envelope.item.getManyByToken',
      { envelopeId: privateTemplate.id, access: { type: 'user' } },
      teamB.id,
    );

    expect(res.ok()).toBeFalsy();
  });

  test('should respect document visibility for the viewer team role', async ({ page }) => {
    const { ownerA, teamA, memberB, teamB } = await seedOrgTemplateScenario();

    const adminOnlyTemplate = await seedBlankTemplate(ownerA, teamA.id, {
      createTemplateOptions: {
        title: `Items Admin Only ${nanoid()}`,
        templateType: TemplateType.ORGANISATION,
        visibility: 'ADMIN',
      },
    });

    // memberB is a MEMBER on teamB — must not be able to read items for an ADMIN-only template.
    await apiSignin({ page, email: memberB.email });

    const { res: memberRes } = await trpcQuery(
      page,
      'envelope.item.getManyByToken',
      { envelopeId: adminOnlyTemplate.id, access: { type: 'user' } },
      teamB.id,
    );

    expect(memberRes.ok()).toBeFalsy();

    await apiSignout({ page });

    // ownerA is ADMIN on teamA — should succeed via the own-team path.
    await apiSignin({ page, email: ownerA.email });

    const { res: adminRes, json: adminJson } = await trpcQuery(
      page,
      'envelope.item.getManyByToken',
      { envelopeId: adminOnlyTemplate.id, access: { type: 'user' } },
      teamA.id,
    );

    expect(adminRes.ok()).toBeTruthy();
    expect(adminJson.result.data.json.data.length).toBeGreaterThan(0);
  });

  test('should reject unauthenticated callers using the user access type', async ({ page }) => {
    const { orgTemplate, teamB } = await seedOrgTemplateScenario();

    // No apiSignin — unauthenticated.

    const { res } = await trpcQuery(
      page,
      'envelope.item.getManyByToken',
      { envelopeId: orgTemplate.id, access: { type: 'user' } },
      teamB.id,
    );

    expect(res.ok()).toBeFalsy();
  });
});
