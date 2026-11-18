import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, OrganisationMemberRole, TeamMemberRole } from '@documenso/prisma/client';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { customAlphabet } from 'nanoid';

import { apiSignin } from '../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

const nanoid = customAlphabet('1234567890abcdef', 10);

test.describe.configure({
  mode: 'parallel',
});

const TEAM_ANALYTICS_PROCEDURES = [
  'team.analytics.getOverview',
  'team.analytics.getDocumentsOverTime',
  'team.analytics.getStatusBreakdown',
  'team.analytics.getTemplateUsage',
  'team.analytics.getMemberActivity',
] as const;

const ORGANISATION_ANALYTICS_PROCEDURES = [
  'organisation.analytics.getOverview',
  'organisation.analytics.getDocumentsOverTime',
  'organisation.analytics.getStatusBreakdown',
  'organisation.analytics.getTemplateUsage',
  'organisation.analytics.getTeamActivity',
] as const;

const seedScenario = async () => {
  const suffix = nanoid();

  const { user: owner, organisation, team: siblingTeam } = await seedUser();

  const targetTeamUrl = `analytics-target-${suffix}`;

  await createTeam({
    userId: owner.id,
    teamName: `Analytics Target Team ${suffix}`,
    teamUrl: targetTeamUrl,
    organisationId: organisation.id,
    // Keeps plain organisation members out of the target team.
    inheritMembers: false,
  });

  const targetTeam = await prisma.team.findFirstOrThrow({ where: { url: targetTeamUrl } });

  const targetManagerName = `Analytics Target Manager ${suffix}`;

  const targetManager = await seedTeamMember({
    teamId: targetTeam.id,
    name: targetManagerName,
    role: TeamMemberRole.MANAGER,
  });

  const targetMember = await seedTeamMember({ teamId: targetTeam.id, role: TeamMemberRole.MEMBER });

  const siblingTeamAdmin = await seedTeamMember({ teamId: siblingTeam.id, role: TeamMemberRole.ADMIN });

  const [organisationMember, organisationManager] = await seedOrganisationMembers({
    organisationId: organisation.id,
    members: [
      { organisationRole: OrganisationMemberRole.MEMBER },
      { organisationRole: OrganisationMemberRole.MANAGER },
    ],
  });

  const { user: outsider, team: outsiderTeam, organisation: outsiderOrganisation } = await seedUser();
  const { user: recipient } = await seedUser();

  const template = await seedBlankTemplate(owner, targetTeam.id, {
    createTemplateOptions: { title: `Analytics Target Template ${suffix}` },
  });

  const document = await seedBlankDocument(targetManager, targetTeam.id, {
    createDocumentOptions: {
      title: `Analytics Target Document ${suffix}`,
      status: DocumentStatus.PENDING,
      templateId: mapSecondaryIdToTemplateId(template.secondaryId),
    },
  });

  await prisma.documentAuditLog.create({
    data: {
      envelopeId: document.id,
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
      createdAt: new Date(),
      data: {},
    },
  });

  await prisma.recipient.create({
    data: {
      envelopeId: document.id,
      email: recipient.email,
      name: 'Analytics Recipient',
      token: nanoid(),
    },
  });

  const markers = {
    teamName: targetTeam.name,
    templateTitle: template.title,
    managerName: targetManagerName,
    managerEmail: targetManager.email,
  };

  return {
    owner,
    organisation,
    targetTeam,
    targetManager,
    targetMember,
    siblingTeamAdmin,
    organisationMember,
    organisationManager,
    outsider,
    outsiderTeam,
    outsiderOrganisation,
    recipient,
    markers: Object.values(markers),
    namedMarkers: markers,
  };
};

type Scenario = Awaited<ReturnType<typeof seedScenario>>;

type DeniedCaller = {
  name: string;
  caller: (scenario: Scenario) => { email: string };
};

const TEAM_DENIED_CALLERS: DeniedCaller[] = [
  { name: 'a user from another organisation', caller: (s) => s.outsider },
  { name: 'a recipient of a team document who is not a member', caller: (s) => s.recipient },
  { name: 'an organisation member who is not in the team', caller: (s) => s.organisationMember },
  { name: 'an admin of a sibling team', caller: (s) => s.siblingTeamAdmin },
  { name: 'a team member below manager', caller: (s) => s.targetMember },
];

const ORGANISATION_DENIED_CALLERS: DeniedCaller[] = [
  { name: 'a user from another organisation', caller: (s) => s.outsider },
  { name: 'a recipient of an organisation document', caller: (s) => s.recipient },
  { name: 'an organisation member', caller: (s) => s.organisationMember },
  { name: 'an organisation manager', caller: (s) => s.organisationManager },
  { name: 'a team admin who is an organisation member', caller: (s) => s.siblingTeamAdmin },
  { name: 'a team manager who is an organisation member', caller: (s) => s.targetManager },
];

test.describe('Team Analytics API - Adversarial: Access', () => {
  test('should reject unauthenticated requests on every procedure', async ({ request }) => {
    const { targetTeam, markers } = await seedScenario();

    for (const procedure of TEAM_ANALYTICS_PROCEDURES) {
      const res = await trpcQuery(request, procedure, { teamId: targetTeam.id });

      expectDenied(res, markers);
    }
  });

  for (const { name, caller } of TEAM_DENIED_CALLERS) {
    test(`should reject ${name} on every procedure`, async ({ page }) => {
      const scenario = await seedScenario();

      await apiSignin({ page, email: caller(scenario).email });

      for (const procedure of TEAM_ANALYTICS_PROCEDURES) {
        const res = await trpcQuery(page.context().request, procedure, { teamId: scenario.targetTeam.id });

        expectDenied(res, scenario.markers);
      }
    });
  }

  test('should allow team admins and managers (control)', async ({ page }) => {
    const { owner, targetManager, organisationManager, targetTeam, namedMarkers } = await seedScenario();

    for (const caller of [owner, targetManager, organisationManager]) {
      await apiSignin({ page, email: caller.email });

      const bodies: string[] = [];

      for (const procedure of TEAM_ANALYTICS_PROCEDURES) {
        const res = await trpcQuery(page.context().request, procedure, { teamId: targetTeam.id });

        expectAllowed(res);
        bodies.push(res.body);
      }

      const combined = bodies.join('\n');

      expect(combined).toContain(namedMarkers.templateTitle);
      expect(combined).toContain(namedMarkers.managerName);
      expect(combined).toContain(namedMarkers.managerEmail);
    }
  });
});

test.describe('Team Analytics API - Adversarial: Tampering', () => {
  test('should ignore identity fields injected into the input', async ({ page }) => {
    const { owner, outsider, targetTeam, markers } = await seedScenario();

    await apiSignin({ page, email: outsider.email });

    for (const procedure of TEAM_ANALYTICS_PROCEDURES) {
      const res = await trpcQuery(page.context().request, procedure, {
        teamId: targetTeam.id,
        userId: owner.id,
        userEmail: owner.email,
      });

      expectDenied(res, markers);
    }
  });

  test('should not grant access through the x-team-id header', async ({ page }) => {
    const { outsider, outsiderTeam, targetTeam, markers } = await seedScenario();

    await apiSignin({ page, email: outsider.email });

    for (const procedure of TEAM_ANALYTICS_PROCEDURES) {
      const targetHeader = await trpcQuery(
        page.context().request,
        procedure,
        { teamId: targetTeam.id },
        { 'x-team-id': targetTeam.id.toString() },
      );

      expectDenied(targetHeader, markers);

      const ownHeader = await trpcQuery(
        page.context().request,
        procedure,
        { teamId: targetTeam.id },
        { 'x-team-id': outsiderTeam.id.toString() },
      );

      expectDenied(ownHeader, markers);
    }
  });

  test('should reject target team calls batched with an allowed call', async ({ page }) => {
    const { outsider, outsiderTeam, targetTeam, markers } = await seedScenario();

    await apiSignin({ page, email: outsider.email });

    const { response, body, results } = await trpcBatchQuery(page.context().request, [
      { procedure: 'team.analytics.getOverview', input: { teamId: outsiderTeam.id } },
      ...TEAM_ANALYTICS_PROCEDURES.map((procedure) => ({ procedure, input: { teamId: targetTeam.id } })),
    ]);

    expect(response.status()).toBe(207);
    expect(results).toHaveLength(TEAM_ANALYTICS_PROCEDURES.length + 1);

    const [allowed, ...denied] = results;

    expect(allowed.result).toBeDefined();
    expect(allowed.error).toBeUndefined();

    for (const item of denied) {
      expect(item.result).toBeUndefined();
      expect(item.error?.json.data.httpStatus).toBe(401);
      expect(item.error?.json.data.code).toBe('UNAUTHORIZED');
    }

    expectNoMarkers(body, markers);
  });

  test('should reject API tokens, even one scoped to the target team', async ({ request }) => {
    const { owner, targetTeam, markers } = await seedScenario();

    const { token } = await createApiToken({
      userId: owner.id,
      teamId: targetTeam.id,
      tokenName: 'analytics-adversarial',
      expiresIn: null,
    });

    for (const procedure of TEAM_ANALYTICS_PROCEDURES) {
      for (const authorization of [`Bearer ${token}`, token]) {
        const res = await trpcQuery(request, procedure, { teamId: targetTeam.id }, { Authorization: authorization });

        expectDenied(res, markers);
      }
    }
  });

  test('should not reveal whether a team exists', async ({ page }) => {
    const { outsider, targetTeam } = await seedScenario();

    await apiSignin({ page, email: outsider.email });

    for (const procedure of TEAM_ANALYTICS_PROCEDURES) {
      const existing = await trpcQuery(page.context().request, procedure, { teamId: targetTeam.id });
      const missing = await trpcQuery(page.context().request, procedure, { teamId: 2_147_483_647 });

      expect(existing.response.status()).toBe(401);
      expect(missing.response.status()).toBe(401);
      expect(errorMessageOf(missing)).toBe(errorMessageOf(existing));
    }
  });
});

test.describe('Organisation Analytics API - Adversarial: Access', () => {
  test('should reject unauthenticated requests on every procedure', async ({ request }) => {
    const { organisation, markers } = await seedScenario();

    for (const procedure of ORGANISATION_ANALYTICS_PROCEDURES) {
      const res = await trpcQuery(request, procedure, { organisationId: organisation.id });

      expectDenied(res, markers);
    }
  });

  for (const { name, caller } of ORGANISATION_DENIED_CALLERS) {
    test(`should reject ${name} on every procedure`, async ({ page }) => {
      const scenario = await seedScenario();

      await apiSignin({ page, email: caller(scenario).email });

      for (const procedure of ORGANISATION_ANALYTICS_PROCEDURES) {
        const res = await trpcQuery(page.context().request, procedure, {
          organisationId: scenario.organisation.id,
        });

        expectDenied(res, scenario.markers);
      }
    });
  }

  test('should allow organisation admins (control)', async ({ page }) => {
    const { owner, organisation, namedMarkers } = await seedScenario();

    await apiSignin({ page, email: owner.email });

    const bodies: string[] = [];

    for (const procedure of ORGANISATION_ANALYTICS_PROCEDURES) {
      const res = await trpcQuery(page.context().request, procedure, { organisationId: organisation.id });

      expectAllowed(res);
      bodies.push(res.body);
    }

    const combined = bodies.join('\n');

    expect(combined).toContain(namedMarkers.teamName);
    expect(combined).toContain(namedMarkers.templateTitle);
  });
});

test.describe('Organisation Analytics API - Adversarial: Tampering', () => {
  test('should ignore identity fields injected into the input', async ({ page }) => {
    const { owner, outsider, organisation, markers } = await seedScenario();

    await apiSignin({ page, email: outsider.email });

    for (const procedure of ORGANISATION_ANALYTICS_PROCEDURES) {
      const res = await trpcQuery(page.context().request, procedure, {
        organisationId: organisation.id,
        userId: owner.id,
        userEmail: owner.email,
      });

      expectDenied(res, markers);
    }
  });

  test('should not grant access through the x-team-id header', async ({ page }) => {
    const { organisationMember, organisation, targetTeam, markers } = await seedScenario();

    await apiSignin({ page, email: organisationMember.email });

    for (const procedure of ORGANISATION_ANALYTICS_PROCEDURES) {
      const res = await trpcQuery(
        page.context().request,
        procedure,
        { organisationId: organisation.id },
        { 'x-team-id': targetTeam.id.toString() },
      );

      expectDenied(res, markers);
    }
  });

  test('should reject target organisation calls batched with an allowed call', async ({ page }) => {
    const { outsider, outsiderOrganisation, organisation, markers } = await seedScenario();

    await apiSignin({ page, email: outsider.email });

    const { response, body, results } = await trpcBatchQuery(page.context().request, [
      { procedure: 'organisation.analytics.getOverview', input: { organisationId: outsiderOrganisation.id } },
      ...ORGANISATION_ANALYTICS_PROCEDURES.map((procedure) => ({
        procedure,
        input: { organisationId: organisation.id },
      })),
    ]);

    expect(response.status()).toBe(207);
    expect(results).toHaveLength(ORGANISATION_ANALYTICS_PROCEDURES.length + 1);

    const [allowed, ...denied] = results;

    expect(allowed.result).toBeDefined();
    expect(allowed.error).toBeUndefined();

    for (const item of denied) {
      expect(item.result).toBeUndefined();
      expect(item.error?.json.data.httpStatus).toBe(401);
      expect(item.error?.json.data.code).toBe('UNAUTHORIZED');
    }

    expectNoMarkers(body, markers);
  });

  test('should reject API tokens, even one belonging to an organisation admin', async ({ request }) => {
    const { owner, organisation, targetTeam, markers } = await seedScenario();

    const { token } = await createApiToken({
      userId: owner.id,
      teamId: targetTeam.id,
      tokenName: 'analytics-adversarial',
      expiresIn: null,
    });

    for (const procedure of ORGANISATION_ANALYTICS_PROCEDURES) {
      for (const authorization of [`Bearer ${token}`, token]) {
        const res = await trpcQuery(
          request,
          procedure,
          { organisationId: organisation.id },
          { Authorization: authorization },
        );

        expectDenied(res, markers);
      }
    }
  });

  test('should not reveal whether an organisation exists', async ({ page }) => {
    const { outsider, organisation } = await seedScenario();

    await apiSignin({ page, email: outsider.email });

    for (const procedure of ORGANISATION_ANALYTICS_PROCEDURES) {
      const existing = await trpcQuery(page.context().request, procedure, { organisationId: organisation.id });
      const missing = await trpcQuery(page.context().request, procedure, {
        organisationId: `org_does_not_exist_${nanoid()}`,
      });

      expect(existing.response.status()).toBe(401);
      expect(missing.response.status()).toBe(401);
      expect(errorMessageOf(missing)).toBe(errorMessageOf(existing));
    }
  });
});

type TrpcResponseItem = {
  result?: { data: { json: unknown } };
  error?: { json: { message: string; data: { code: string; httpStatus: number } } };
};

type TrpcResult = {
  response: APIResponse;
  body: string;
  json: TrpcResponseItem | null;
};

const DEFAULT_ANALYTICS_INPUT = { range: '30d', timezone: 'UTC' };

const trpcQuery = async (
  request: APIRequestContext,
  procedure: string,
  input: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<TrpcResult> => {
  const inputParam = encodeURIComponent(JSON.stringify({ json: { ...DEFAULT_ANALYTICS_INPUT, ...input } }));

  const response = await request.get(`${WEBAPP_BASE_URL}/api/trpc/${procedure}?input=${inputParam}`, { headers });

  const body = await response.text();

  return { response, body, json: parseJson<TrpcResponseItem>(body) };
};

const trpcBatchQuery = async (
  request: APIRequestContext,
  calls: Array<{ procedure: string; input: Record<string, unknown> }>,
) => {
  const procedures = calls.map((call) => call.procedure).join(',');

  const input = Object.fromEntries(
    calls.map((call, index) => [index, { json: { ...DEFAULT_ANALYTICS_INPUT, ...call.input } }]),
  );

  const response = await request.get(
    `${WEBAPP_BASE_URL}/api/trpc/${procedures}?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
  );

  const body = await response.text();

  return { response, body, results: parseJson<TrpcResponseItem[]>(body) ?? [] };
};

const parseJson = <T>(body: string): T | null => {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

const errorMessageOf = (res: TrpcResult) => res.json?.error?.json.message;

const expectNoMarkers = (body: string, markers: string[]) => {
  for (const marker of markers) {
    expect(body).not.toContain(marker);
  }
};

const expectDenied = (res: TrpcResult, markers: string[]) => {
  expect(res.response.status()).toBe(401);
  expect(res.json?.result).toBeUndefined();
  expect(res.json?.error?.json.data.code).toBe('UNAUTHORIZED');

  expectNoMarkers(res.body, markers);
};

const expectAllowed = (res: TrpcResult) => {
  expect(res.response.status()).toBe(200);
  expect(res.json?.result?.data.json).toBeDefined();
};
