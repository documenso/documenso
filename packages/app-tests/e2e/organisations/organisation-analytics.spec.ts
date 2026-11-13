import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { prisma } from '@documenso/prisma';
import type { User } from '@documenso/prisma/client';
import { DocumentStatus, DocumentVisibility, OrganisationMemberRole, TeamMemberRole } from '@documenso/prisma/client';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { customAlphabet } from 'nanoid';

import { apiSignin, apiSignout } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

const nanoid = customAlphabet('1234567890abcdef', 10);

type AnalyticsRange = '7d' | '30d' | '90d' | '12m';

/**
 * Timestamps are relative to now and kept at least a day away from every window
 * boundary (7, 30, 60 and 90 days) so the assertions hold regardless of timezone.
 */
const daysAgo = (days: number) => DateTime.now().minus({ days }).toJSDate();

test.describe.configure({ mode: 'parallel' });

test('[ORG ANALYTICS]: admin sees aggregated numbers across teams', async ({ page }) => {
  const { owner, teamA, teamB, organisation } = await seedOrganisationWithTwoTeams();

  // Team A: 4 sent, 3 completed.
  await seedAnalyticsDocument({ owner, teamId: teamA.id, status: DocumentStatus.COMPLETED, sentAt: daysAgo(2) });
  await seedAnalyticsDocument({ owner, teamId: teamA.id, status: DocumentStatus.COMPLETED, sentAt: daysAgo(3) });
  await seedAnalyticsDocument({ owner, teamId: teamA.id, status: DocumentStatus.COMPLETED, sentAt: daysAgo(4) });
  await seedAnalyticsDocument({ owner, teamId: teamA.id, status: DocumentStatus.PENDING, sentAt: daysAgo(5) });

  // Team B: 3 sent, 2 completed. Organisation admins see every document, so the
  // ADMIN-visibility one counts too.
  await seedAnalyticsDocument({ owner, teamId: teamB.id, status: DocumentStatus.COMPLETED, sentAt: daysAgo(6) });
  await seedAnalyticsDocument({ owner, teamId: teamB.id, status: DocumentStatus.PENDING, sentAt: daysAgo(8) });
  await seedAnalyticsDocument({
    owner,
    teamId: teamB.id,
    status: DocumentStatus.COMPLETED,
    visibility: DocumentVisibility.ADMIN,
    sentAt: daysAgo(9),
  });

  await apiSignin({ page, email: owner.email, redirectPath: analyticsPath(organisation.url) });
  await waitForAnalytics(page);

  // Overview: 7 sent, 5 completed (71%), both teams active.
  await expect(page.getByTestId('analytics-sent')).toHaveText('7');
  await expect(page.getByTestId('analytics-completion-rate')).toHaveText('71%');
  await expect(page.getByTestId('analytics-teams')).toHaveText('2/2');

  await expect(page.getByTestId('analytics-documents-over-time-total')).toHaveText('7 total');
  await expect(page.getByTestId('analytics-status-completed')).toHaveText('5');
  await expect(page.getByTestId('analytics-status-pending')).toHaveText('2');

  // Team activity: sorted by sent desc, so team A (4) comes before team B (3).
  const rows = page.getByTestId('analytics-team-row');

  await expect(page.getByTestId('analytics-team-summary')).toContainText('2 teams');
  await expect(page.getByTestId('analytics-team-summary')).toContainText('2 active');
  await expect(rows).toHaveCount(2);

  await expect(rows.nth(0)).toContainText(teamA.name);
  await expect(rows.nth(0)).toContainText(`/t/${teamA.url}`);
  await expectTeamRow(rows.nth(0), { sent: '4', completed: '3', pending: '1', completionRate: '75%' });

  await expect(rows.nth(1)).toContainText(teamB.name);
  await expect(rows.nth(1)).toContainText(`/t/${teamB.url}`);
  await expectTeamRow(rows.nth(1), { sent: '3', completed: '2', pending: '1', completionRate: '67%' });
});

test("[ORG ANALYTICS]: clicking a team row opens that team's analytics", async ({ page }) => {
  const { owner, teamA, organisation } = await seedOrganisationWithTwoTeams();

  // Team A has activity so it is sorted first.
  await seedAnalyticsDocument({ owner, teamId: teamA.id, status: DocumentStatus.COMPLETED, sentAt: daysAgo(2) });

  await apiSignin({ page, email: owner.email, redirectPath: analyticsPath(organisation.url) });
  await waitForAnalytics(page);

  const firstRow = page.getByTestId('analytics-team-row').first();

  // The title is a real link to the team's analytics.
  await expect(firstRow.getByRole('link', { name: teamA.name })).toHaveAttribute('href', `/t/${teamA.url}/analytics`);

  // Clicking a non-link cell navigates via the row click handler.
  await firstRow.getByTestId('analytics-team-sent').click();
  await page.waitForURL(new RegExp(`/t/${teamA.url}/analytics(?:\\?.*)?$`));
});

test('[ORG ANALYTICS]: only organisation admins can access', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam();

  // Team members seeded this way are organisation MEMBERs.
  const member = await seedTeamMember({
    teamId: team.id,
    name: 'Analytics Member',
    role: TeamMemberRole.ADMIN,
  });

  const [manager] = await seedOrganisationMembers({
    members: [{ name: 'Analytics Manager', organisationRole: OrganisationMemberRole.MANAGER }],
    organisationId: organisation.id,
  });

  const organisationHomePattern = new RegExp(`/o/${organisation.url}(?:\\?.*)?$`);

  // Unauthenticated: the page redirects to sign in and the API rejects the call.
  await page.goto(analyticsPath(organisation.url));
  await page.waitForURL(/\/signin(?:\?.*)?$/);

  const unauthenticatedResponse = await requestOverview(page, organisation.id);
  expect(unauthenticatedResponse.status()).toBe(401);

  // Organisation member: redirected to the organisation home, API rejects the call.
  await apiSignin({ page, email: member.email, redirectPath: analyticsPath(organisation.url) });
  await page.waitForURL(organisationHomePattern);

  const memberResponse = await requestOverview(page, organisation.id);
  expect(memberResponse.status()).toBe(401);

  await apiSignout({ page });

  // Organisation manager: the gate is ADMIN only, so managers are rejected too.
  await apiSignin({ page, email: manager.email, redirectPath: analyticsPath(organisation.url) });
  await page.waitForURL(organisationHomePattern);

  const managerResponse = await requestOverview(page, organisation.id);
  expect(managerResponse.status()).toBe(401);

  await apiSignout({ page });

  // Non-member denial: a user outside the organisation is redirected away and rejected by the API.
  const { user: nonMember } = await seedUser();

  await apiSignin({ page, email: nonMember.email, redirectPath: analyticsPath(organisation.url) });
  await page.waitForURL(organisationHomePattern);

  const nonMemberResponse = await requestOverview(page, organisation.id);
  expect(nonMemberResponse.status()).toBe(401);

  await apiSignout({ page });

  // Organisation admin: the menu switcher links to the page and the API responds.
  await apiSignin({ page, email: owner.email, redirectPath: `/o/${organisation.url}` });

  await page.getByTestId('menu-switcher').click();

  // Outside a team context the single "Analytics" item points at organisation analytics.
  const analyticsMenuItem = page.getByRole('menuitem', { name: 'Analytics', exact: true });

  await expect(analyticsMenuItem).toHaveAttribute('href', `/o/${organisation.url}/analytics`);
  await analyticsMenuItem.click();

  await page.waitForURL(new RegExp(`/o/${organisation.url}/analytics(?:\\?.*)?$`));
  await waitForAnalytics(page);

  // Inside a team context the item points at team analytics, and the team page links onwards.
  await page.goto(`/t/${team.url}/analytics`);
  await waitForAnalytics(page);

  await page.getByTestId('menu-switcher').click();

  await expect(page.getByRole('menuitem', { name: 'Analytics', exact: true })).toHaveAttribute(
    'href',
    `/t/${team.url}/analytics`,
  );

  await page.keyboard.press('Escape');

  await page.getByRole('link', { name: 'View organisation analytics' }).click();
  await page.waitForURL(new RegExp(`/o/${organisation.url}/analytics(?:\\?.*)?$`));

  const adminResponse = await requestOverview(page, organisation.id);
  expect(adminResponse.ok()).toBe(true);
  expect(await adminResponse.text()).toContain('"completionRate"');
});

/**
 * Seed an organisation with two teams. The owner is an organisation ADMIN and,
 * through `inheritMembers`, an admin of both teams.
 */
const seedOrganisationWithTwoTeams = async () => {
  const { owner, team: teamA, organisation } = await seedTeam();

  const teamBUrl = `analytics-team-b-${nanoid()}`;

  await createTeam({
    userId: owner.id,
    teamName: 'Analytics Team B',
    teamUrl: teamBUrl,
    organisationId: organisation.id,
    inheritMembers: true,
  });

  const teamB = await prisma.team.findFirstOrThrow({
    where: {
      url: teamBUrl,
    },
  });

  return { owner, teamA, teamB, organisation };
};

/**
 * Seed a team document with an optional DOCUMENT_SENT audit log.
 */
const seedAnalyticsDocument = async ({
  owner,
  teamId,
  status,
  visibility = DocumentVisibility.EVERYONE,
  sentAt,
}: {
  owner: User;
  teamId: number;
  status: DocumentStatus;
  visibility?: DocumentVisibility;
  sentAt?: Date;
}) => {
  const envelope = await seedBlankDocument(owner, teamId, {
    createDocumentOptions: {
      status,
      visibility,
      ...(status === DocumentStatus.COMPLETED && sentAt ? { completedAt: sentAt } : {}),
    },
  });

  if (sentAt) {
    await prisma.documentAuditLog.createMany({
      data: [
        {
          envelopeId: envelope.id,
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
          createdAt: sentAt,
          data: {},
        },
      ],
    });
  }

  return envelope;
};

const analyticsPath = (organisationUrl: string, range?: AnalyticsRange) => {
  const path = `/o/${organisationUrl}/analytics`;

  return range ? `${path}?range=${range}` : path;
};

/**
 * The analytics queries only run after hydration, which can be slow on a cold dev
 * server, so wait for the hydrate fallback to be replaced before asserting values.
 */
const waitForAnalytics = async (page: Page) => {
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('analytics-loading')).toHaveCount(0, { timeout: 30_000 });
};

const expectTeamRow = async (
  row: Locator,
  expected: { sent: string; completed: string; pending: string; completionRate: string },
) => {
  await expect(row.getByTestId('analytics-team-sent')).toHaveText(expected.sent);
  await expect(row.getByTestId('analytics-team-completed')).toHaveText(expected.completed);
  await expect(row.getByTestId('analytics-team-pending')).toHaveText(expected.pending);
  await expect(row.getByTestId('analytics-team-completion-rate')).toHaveText(expected.completionRate);
};

const requestAnalytics = async (page: Page, procedure: 'getOverview' | 'getTeamActivity', organisationId: string) => {
  const input = encodeURIComponent(JSON.stringify({ json: { organisationId, range: '30d', timezone: 'UTC' } }));

  return await page
    .context()
    .request.get(`${WEBAPP_BASE_URL}/api/trpc/organisation.analytics.${procedure}?input=${input}`);
};

const requestOverview = async (page: Page, organisationId: string) => {
  return await requestAnalytics(page, 'getOverview', organisationId);
};
