import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import type { User } from '@documenso/prisma/client';
import { DocumentStatus, DocumentVisibility, TeamMemberRole } from '@documenso/prisma/client';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import type { TGetTeamAnalyticsDocumentsOverTimeResponse } from '@documenso/trpc/server/team-router/get-team-analytics.types';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';

import { apiSignin, apiSignout } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

type AnalyticsRange = '7d' | '30d' | '90d' | '12m';

/**
 * Timestamps are relative to now and kept at least a day away from every window
 * boundary (7, 30, 60 and 90 days) so the assertions hold regardless of timezone.
 */
const daysAgo = (days: number) => DateTime.now().minus({ days }).toJSDate();

/**
 * The same day as `daysAgo` as a yyyy-MM-dd calendar date in the host timezone,
 * which is also the browser timezone the page sends with custom ranges.
 */
const daysAgoDate = (days: number) => DateTime.now().minus({ days }).toFormat('yyyy-MM-dd');

test.describe.configure({ mode: 'parallel' });

test('[ANALYTICS]: admin sees overview numbers for the last 30 days', async ({ page }) => {
  const { team, owner } = await seedTeam();

  // Current window: 5 sent, 3 completed.
  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.COMPLETED, sentAt: daysAgo(2) });
  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.PENDING, sentAt: daysAgo(3) });
  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.COMPLETED, sentAt: daysAgo(4) });
  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.COMPLETED, sentAt: daysAgo(12) });
  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.PENDING, sentAt: daysAgo(15) });

  // Previous window: 2 sent, 1 completed.
  const resentDocument = await seedAnalyticsDocument({
    owner,
    teamId: team.id,
    status: DocumentStatus.COMPLETED,
    sentAt: daysAgo(40),
  });
  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.PENDING, sentAt: daysAgo(45) });

  // First send: a re-send inside the current window leaves the document counted once, in the previous window.
  await prisma.documentAuditLog.create({
    data: {
      envelopeId: resentDocument.id,
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
      createdAt: daysAgo(20),
      data: {},
    },
  });

  // Soft delete: a deleted document sent in the window is excluded, so none of the numbers below change.
  await seedAnalyticsDocument({
    owner,
    teamId: team.id,
    status: DocumentStatus.COMPLETED,
    sentAt: daysAgo(6),
    deletedAt: new Date(),
  });

  // Never sent. Every document above without `createdAt` was created today.
  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.DRAFT });

  // Never sent, created just after local midnight so bucketing in the wrong timezone would shift their day.
  const createdDaysAgo = [3, 3, 5];

  for (const days of createdDaysAgo) {
    await seedAnalyticsDocument({
      owner,
      teamId: team.id,
      status: DocumentStatus.DRAFT,
      createdAt: DateTime.now().minus({ days }).startOf('day').plus({ minutes: 30 }).toJSDate(),
    });
  }

  await apiSignin({ page, email: owner.email, redirectPath: analyticsPath(team.url) });
  await waitForAnalytics(page);

  await expect(page.getByTestId('analytics-range')).toContainText('Last 30 days');

  await expect(page.getByTestId('analytics-sent')).toHaveText('5');
  await expect(page.getByTestId('analytics-sent-delta')).toHaveText('+150%');
  await expect(page.getByTestId('analytics-completion-rate')).toHaveText('60%');
  await expect(page.getByTestId('analytics-completion-rate-delta')).toHaveText('+10%');
  await expect(page.getByTestId('analytics-members')).toHaveText('1/1');

  // Day buckets: documents land on their creation day in the request timezone and empty days are zero-filled.
  const daily = await requestDocumentsOverTime(page, team.id, { range: '30d' });

  expect(daily.points).toHaveLength(30);
  expect(daily.points).toContainEqual({ date: daysAgoDate(3), count: 2 });
  expect(daily.points).toContainEqual({ date: daysAgoDate(4), count: 0 });
  expect(daily.points).toContainEqual({ date: daysAgoDate(5), count: 1 });

  // Month buckets: keyed by month start, the last one sums this month's documents (8 created today, deleted excluded).
  const monthStart = DateTime.now().startOf('month');
  const createdThisMonth = 8 + createdDaysAgo.filter((days) => DateTime.now().minus({ days }) >= monthStart).length;
  const monthly = await requestDocumentsOverTime(page, team.id, { range: '12m' });

  expect(monthly.points).toHaveLength(12);
  expect(monthly.points.at(-1)).toEqual({ date: monthStart.toFormat('yyyy-MM-dd'), count: createdThisMonth });

  // Switching to 90 days pulls the previous window into the current one.
  await selectRange(page, 'Last 90 days');
  await expectRangeParam(page, '90d');
  await expect(page.getByTestId('analytics-sent')).toHaveText('7');

  // Loading a range directly from the URL works too. The 7 day previous window
  // (7-14 days ago) only contains the document sent 12 days ago.
  await page.goto(analyticsPath(team.url, '7d'));
  await waitForAnalytics(page);
  await expect(page.getByTestId('analytics-sent')).toHaveText('3');
  await expect(page.getByTestId('analytics-sent-delta')).toHaveText('+200%');
});

test('[ANALYTICS]: a custom date range scopes activity to the selected days', async ({ page }) => {
  const { team, owner } = await seedTeam();

  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.COMPLETED, sentAt: daysAgo(3) });
  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.PENDING, sentAt: daysAgo(5) });
  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.COMPLETED, sentAt: daysAgo(20) });
  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.COMPLETED, sentAt: daysAgo(40) });
  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.PENDING, sentAt: daysAgo(50) });
  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.COMPLETED, sentAt: daysAgo(200) });

  // A 16 day window loaded from the URL only contains the document sent 20 days
  // ago. The equally sized previous window (41-26 days ago) contains the one sent
  // 40 days ago, so the delta is flat.
  const windowFrom = daysAgoDate(25);
  const windowTo = daysAgoDate(10);

  await apiSignin({ page, email: owner.email, redirectPath: customAnalyticsPath(team.url, windowFrom, windowTo) });
  await waitForAnalytics(page);

  await expect(page.getByTestId('analytics-sent')).toHaveText('1');
  await expect(page.getByTestId('analytics-sent-delta')).toHaveText('0%');
  await expect(page.getByTestId('analytics-documents-over-time')).toContainText('Daily');

  // The trigger shows the formatted window, e.g. "Aug 29 – Sep 13, 2026".
  const rangeTrigger = page.getByTestId('analytics-range');

  await expect(rangeTrigger).toContainText(String(DateTime.fromISO(windowTo).year));

  // Picking a new window in the calendar replaces the current one on apply.
  const pickedFrom = daysAgoDate(6);
  const pickedTo = daysAgoDate(2);

  await rangeTrigger.click();
  await page.getByTestId('analytics-range-custom').click();

  await clickCalendarDay(page, pickedFrom);
  await clickCalendarDay(page, pickedTo);
  await page.getByTestId('analytics-range-apply').click();

  await expectCustomRangeParams(page, pickedFrom, pickedTo);
  await expect(page.getByTestId('analytics-range-calendar')).toHaveCount(0);
  await expect(page.getByTestId('analytics-sent')).toHaveText('2');
  await expect(page.getByTestId('analytics-sent-delta')).toHaveText('New');

  // Windows longer than 92 days are bucketed by month.
  await page.goto(customAnalyticsPath(team.url, daysAgoDate(120), daysAgoDate(1)));
  await waitForAnalytics(page);

  await expect(page.getByTestId('analytics-documents-over-time')).toContainText('Monthly');
  await expect(page.getByTestId('analytics-sent')).toHaveText('5');

  // An invalid window (from after to) falls back to the default preset and the
  // stray params are cleared from the URL.
  await page.goto(customAnalyticsPath(team.url, daysAgoDate(5), daysAgoDate(10)));
  await waitForAnalytics(page);

  await expect.poll(() => page.url()).not.toContain('range=custom');
  await expect.poll(() => new URL(page.url()).searchParams.has('from')).toBe(false);
  await expect(page.getByTestId('analytics-sent')).toHaveText('3');

  // A window starting more than 12 months ago is rejected the same way.
  await page.goto(customAnalyticsPath(team.url, daysAgoDate(400), daysAgoDate(380)));
  await waitForAnalytics(page);

  await expect.poll(() => page.url()).not.toContain('range=custom');

  // The API rejects an invalid custom window outright (the resolver rules
  // themselves are unit tested).
  const invalidResponse = await requestOverview(page, team.id, {
    range: 'custom',
    from: daysAgoDate(5),
    to: daysAgoDate(10),
  });

  expect(invalidResponse.status()).toBe(400);
});

test('[ANALYTICS]: a manager only sees documents within their visibility scope', async ({ page }) => {
  const { team, owner } = await seedTeam();
  const manager = await seedTeamMember({
    teamId: team.id,
    name: 'Analytics Manager',
    role: TeamMemberRole.MANAGER,
  });

  for (const status of [DocumentStatus.COMPLETED, DocumentStatus.COMPLETED, DocumentStatus.PENDING]) {
    await seedAnalyticsDocument({
      owner,
      teamId: team.id,
      status,
      visibility: DocumentVisibility.EVERYONE,
      sentAt: daysAgo(3),
    });
  }

  for (const status of [DocumentStatus.COMPLETED, DocumentStatus.COMPLETED]) {
    await seedAnalyticsDocument({
      owner,
      teamId: team.id,
      status,
      visibility: DocumentVisibility.ADMIN,
      sentAt: daysAgo(4),
    });
  }

  // Owner clause: an ADMIN-only document the manager owns is in their scope, unlike the owner's ADMIN-only ones.
  await seedAnalyticsDocument({
    owner: manager,
    teamId: team.id,
    status: DocumentStatus.COMPLETED,
    visibility: DocumentVisibility.ADMIN,
    sentAt: daysAgo(3),
  });

  await apiSignin({ page, email: manager.email, redirectPath: analyticsPath(team.url) });
  await waitForAnalytics(page);

  await expect(page.getByTestId('analytics-sent')).toHaveText('4');
  await expect(page.getByTestId('analytics-status-completed')).toHaveText('3');
  await expect(page.getByTestId('analytics-status-pending')).toHaveText('1');
  await expect(page.getByTestId('analytics-documents-over-time-total')).toHaveText('4 total');
  await expect(page.getByTestId('analytics-members')).toHaveText('2/2');

  // An ADMIN-only document still counts for the manager when they are a recipient.
  await seedAnalyticsDocument({
    owner,
    teamId: team.id,
    status: DocumentStatus.PENDING,
    visibility: DocumentVisibility.ADMIN,
    sentAt: daysAgo(5),
    recipientEmail: manager.email,
  });

  await page.reload();
  await waitForAnalytics(page);

  await expect(page.getByTestId('analytics-sent')).toHaveText('5');
  await expect(page.getByTestId('analytics-status-completed')).toHaveText('3');
  await expect(page.getByTestId('analytics-status-pending')).toHaveText('2');
  await expect(page.getByTestId('analytics-documents-over-time-total')).toHaveText('5 total');

  await apiSignout({ page });
  await apiSignin({ page, email: owner.email, redirectPath: analyticsPath(team.url) });
  await waitForAnalytics(page);

  await expect(page.getByTestId('analytics-sent')).toHaveText('7');
  await expect(page.getByTestId('analytics-status-completed')).toHaveText('5');
  await expect(page.getByTestId('analytics-status-pending')).toHaveText('2');
  await expect(page.getByTestId('analytics-documents-over-time-total')).toHaveText('7 total');
});

test('[ANALYTICS]: template usage ranks templates by documents created from them', async ({ page }) => {
  const { team, owner } = await seedTeam();

  const popularTemplate = await seedBlankTemplate(owner, team.id, {
    createTemplateOptions: { title: 'Analytics Popular Template' },
  });
  const otherTemplate = await seedBlankTemplate(owner, team.id, {
    createTemplateOptions: { title: 'Analytics Other Template' },
  });
  const deletedTemplate = await seedBlankTemplate(owner, team.id, {
    createTemplateOptions: { title: 'Analytics Deleted Template', deletedAt: new Date() },
  });

  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.PENDING, sentAt: daysAgo(2) });
  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.COMPLETED, sentAt: daysAgo(3) });

  // Distinct counts so the order does not depend on the tie-breaker.
  for (const [template, count] of [
    [popularTemplate, 3],
    [otherTemplate, 2],
    [deletedTemplate, 1],
  ] as const) {
    for (let index = 0; index < count; index += 1) {
      await seedAnalyticsDocument({
        owner,
        teamId: team.id,
        status: DocumentStatus.PENDING,
        sentAt: daysAgo(2),
        templateSecondaryId: template.secondaryId,
      });
    }
  }

  await apiSignin({ page, email: owner.email, redirectPath: analyticsPath(team.url) });
  await waitForAnalytics(page);

  const rows = page.getByTestId('analytics-template-row');

  await expect(rows).toHaveCount(3);

  await expect(rows.nth(0)).toContainText('Analytics Popular Template');
  await expect(rows.nth(0)).toContainText('3 uses');
  await expect(rows.nth(0).getByRole('link', { name: 'Analytics Popular Template' })).toHaveAttribute(
    'href',
    `/t/${team.url}/templates/${popularTemplate.id}`,
  );

  await expect(rows.nth(1)).toContainText('Analytics Other Template');
  await expect(rows.nth(1)).toContainText('2 uses');

  await expect(rows.nth(2)).toContainText('Unavailable template');
  await expect(rows.nth(2)).toContainText('1 use');
  await expect(rows.nth(2)).not.toContainText('Analytics Deleted Template');
  await expect(rows.nth(2).getByRole('link')).toHaveCount(0);
});

test('[ANALYTICS]: member activity respects visibility per member', async ({ page }) => {
  // `seedTeam` hardcodes the owner name, so seed the owner directly to control it.
  const { user: jane, team } = await seedUser({ name: 'Jane Analytics' });

  const manager = await seedTeamMember({
    teamId: team.id,
    name: 'Analytics Manager',
    role: TeamMemberRole.MANAGER,
  });

  await seedTeamMember({
    teamId: team.id,
    name: 'Analytics Member',
    role: TeamMemberRole.MEMBER,
  });

  // Jane: 3 EVERYONE (2 completed, 1 pending) + 2 ADMIN-only (both completed).
  for (const status of [DocumentStatus.COMPLETED, DocumentStatus.COMPLETED, DocumentStatus.PENDING]) {
    await seedAnalyticsDocument({
      owner: jane,
      teamId: team.id,
      status,
      visibility: DocumentVisibility.EVERYONE,
      sentAt: daysAgo(3),
    });
  }

  for (const status of [DocumentStatus.COMPLETED, DocumentStatus.COMPLETED]) {
    await seedAnalyticsDocument({
      owner: jane,
      teamId: team.id,
      status,
      visibility: DocumentVisibility.ADMIN,
      sentAt: daysAgo(4),
    });
  }

  // Manager: 2 EVERYONE (1 completed, 1 pending).
  for (const status of [DocumentStatus.COMPLETED, DocumentStatus.PENDING]) {
    await seedAnalyticsDocument({
      owner: manager,
      teamId: team.id,
      status,
      visibility: DocumentVisibility.EVERYONE,
      sentAt: daysAgo(5),
    });
  }

  const rows = page.getByTestId('analytics-member-row');

  // Admin sees everything.
  await apiSignin({ page, email: jane.email, redirectPath: analyticsPath(team.url) });
  await waitForAnalytics(page);

  await expect(page.getByTestId('analytics-member-summary')).toContainText('3 members');
  await expect(page.getByTestId('analytics-member-summary')).toContainText('2 active');
  await expect(rows).toHaveCount(3);

  await expect(rows.nth(0)).toContainText('Jane Analytics');
  await expectMemberRow(rows.nth(0), { sent: '5', completed: '4', pending: '1', completionRate: '80%' });

  await expect(rows.nth(1)).toContainText('Analytics Manager');
  await expectMemberRow(rows.nth(1), { sent: '2', completed: '1', pending: '1', completionRate: '50%' });

  await expect(rows.nth(2)).toContainText('Analytics Member');
  await expectMemberRow(rows.nth(2), { sent: '0', completed: '0', pending: '0', completionRate: '—' });

  // Search filters the table case-insensitively.
  const search = page.getByTestId('analytics-member-search');

  await search.fill('MANAGER');
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText('Analytics Manager');

  await search.fill('');
  await expect(rows).toHaveCount(3);

  // Manager: Jane's two ADMIN-only documents are excluded from her row.
  await apiSignout({ page });
  await apiSignin({ page, email: manager.email, redirectPath: analyticsPath(team.url) });
  await waitForAnalytics(page);

  await expect(rows).toHaveCount(3);

  await expect(rows.nth(0)).toContainText('Jane Analytics');
  await expectMemberRow(rows.nth(0), { sent: '3', completed: '2', pending: '1', completionRate: '67%' });
});

test('[ANALYTICS]: member activity previews 8 members and can show all', async ({ page }) => {
  // 8 organisation members inherited into the team + the owner = 9 team members.
  const { team, owner } = await seedTeam({ createTeamMembers: 8 });

  const rows = page.getByTestId('analytics-member-row');

  await apiSignin({ page, email: owner.email, redirectPath: analyticsPath(team.url) });
  await waitForAnalytics(page);

  await expect(page.getByTestId('analytics-member-summary')).toContainText('9 members');
  await expect(rows).toHaveCount(8);

  await page.getByTestId('analytics-member-show-all').click();

  await expect(rows).toHaveCount(9);
  await expect(page.getByTestId('analytics-member-show-all')).toHaveCount(0);
});

test('[ANALYTICS]: members and unauthenticated users cannot access analytics', async ({ page }) => {
  const { team, owner } = await seedTeam();
  const member = await seedTeamMember({
    teamId: team.id,
    name: 'Analytics Member',
    role: TeamMemberRole.MEMBER,
  });

  const documentsPathPattern = new RegExp(`/t/${team.url}/documents(?:\\?.*)?$`);

  // Unauthenticated: the page redirects to sign in and the API rejects the call.
  await page.goto(analyticsPath(team.url));
  await page.waitForURL(/\/signin(?:\?.*)?$/);

  const unauthenticatedResponse = await requestOverview(page, team.id);
  expect(unauthenticatedResponse.status()).toBe(401);

  // Member: no nav link, redirected away from the page, API rejects the calls.
  await apiSignin({ page, email: member.email, redirectPath: `/t/${team.url}/documents` });
  await page.waitForURL(documentsPathPattern);

  await page.getByTestId('menu-switcher').click();

  // Anchor on an item every user sees, so the absence check can't pass on an unopened menu.
  await expect(page.getByRole('menuitem', { name: 'Inbox', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Analytics', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.goto(analyticsPath(team.url));
  await page.waitForURL(documentsPathPattern);

  const memberOverviewResponse = await requestOverview(page, team.id);
  expect(memberOverviewResponse.status()).toBe(401);

  const memberActivityResponse = await requestMemberActivity(page, team.id);
  expect(memberActivityResponse.status()).toBe(401);

  await apiSignout({ page });

  // Non-member denial: a user outside the team's organisation gets "Team not found", not a crash,
  // and is rejected by the API.
  const { user: nonMember } = await seedUser();

  await apiSignin({ page, email: nonMember.email });

  await page.goto(analyticsPath(team.url));
  await page.waitForURL(documentsPathPattern);
  await expect(page.getByRole('heading', { name: 'Team not found' })).toBeVisible();

  const nonMemberResponse = await requestOverview(page, team.id);
  expect(nonMemberResponse.status()).toBe(401);

  await apiSignout({ page });

  // Admin: the menu switcher item leads to the analytics page.
  await apiSignin({ page, email: owner.email, redirectPath: `/t/${team.url}/documents` });

  await page.getByTestId('menu-switcher').click();
  await page.getByRole('menuitem', { name: 'Analytics', exact: true }).click();
  await page.waitForURL(new RegExp(`/t/${team.url}/analytics(?:\\?.*)?$`));
  await waitForAnalytics(page);

  const adminResponse = await requestOverview(page, team.id);
  expect(adminResponse.ok()).toBe(true);
});

test('[ANALYTICS]: an empty team renders empty states without errors', async ({ page }) => {
  const { team, owner } = await seedTeam();

  await apiSignin({ page, email: owner.email, redirectPath: analyticsPath(team.url) });
  await waitForAnalytics(page);

  await expect(page.getByTestId('analytics-sent')).toHaveText('0');
  await expect(page.getByTestId('analytics-sent-delta')).toHaveCount(0);
  await expect(page.getByTestId('analytics-completion-rate')).toHaveText('—');
  await expect(page.getByTestId('analytics-completion-rate-delta')).toHaveCount(0);
  await expect(page.getByTestId('analytics-members')).toHaveText('0/1');

  await expect(page.getByTestId('analytics-documents-over-time-total')).toHaveText('0 total');
  await expect(page.getByTestId('analytics-status-completed')).toHaveCount(0);
  await expect(page.getByTestId('analytics-template-row')).toHaveCount(0);

  // The zero-row checks above would also pass if a card errored, so assert that none did.
  await expect(page.getByTestId('analytics-error')).toHaveCount(0);
});

/**
 * Seed a team document with an optional DOCUMENT_SENT audit log, recipient and
 * source template.
 */
const seedAnalyticsDocument = async ({
  owner,
  teamId,
  status,
  visibility = DocumentVisibility.EVERYONE,
  sentAt,
  recipientEmail,
  templateSecondaryId,
  createdAt,
  deletedAt,
}: {
  owner: User;
  teamId: number;
  status: DocumentStatus;
  visibility?: DocumentVisibility;
  sentAt?: Date;
  recipientEmail?: string;
  templateSecondaryId?: string;
  createdAt?: Date;
  deletedAt?: Date;
}) => {
  const envelope = await seedBlankDocument(owner, teamId, {
    createDocumentOptions: {
      status,
      visibility,
      createdAt,
      deletedAt,
      ...(status === DocumentStatus.COMPLETED && sentAt ? { completedAt: sentAt } : {}),
      ...(templateSecondaryId ? { templateId: mapSecondaryIdToTemplateId(templateSecondaryId) } : {}),
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

  if (recipientEmail) {
    await prisma.recipient.create({
      data: {
        envelopeId: envelope.id,
        email: recipientEmail,
        name: 'Analytics Recipient',
        token: Math.random().toString().slice(2, 12),
      },
    });
  }

  return envelope;
};

const analyticsPath = (teamUrl: string, range?: AnalyticsRange) => {
  const path = `/t/${teamUrl}/analytics`;

  return range ? `${path}?range=${range}` : path;
};

const customAnalyticsPath = (teamUrl: string, from: string, to: string) => {
  return `${analyticsPath(teamUrl)}?range=custom&from=${from}&to=${to}`;
};

/**
 * The analytics queries only run after hydration, which can be slow on a cold dev
 * server, so wait for the hydrate fallback to be replaced before asserting values.
 */
const waitForAnalytics = async (page: Page) => {
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('analytics-loading')).toHaveCount(0, { timeout: 30_000 });
};

const selectRange = async (page: Page, label: string) => {
  await page.getByTestId('analytics-range').click();
  await page.getByRole('option', { name: label, exact: true }).click();
};

const expectRangeParam = async (page: Page, range: AnalyticsRange) => {
  await expect.poll(() => new URL(page.url()).searchParams.get('range')).toBe(range);
};

const expectCustomRangeParams = async (page: Page, from: string, to: string) => {
  await expect
    .poll(() => {
      const { searchParams } = new URL(page.url());

      return { range: searchParams.get('range'), from: searchParams.get('from'), to: searchParams.get('to') };
    })
    .toEqual({ range: 'custom', from, to });
};

/**
 * Click a yyyy-MM-dd day in the open range calendar. Each visible month renders a
 * grid labelled by its caption (e.g. "September 2026"), so the day button is
 * scoped to the matching grid to avoid hitting the same day number in the other month.
 */
const clickCalendarDay = async (page: Page, date: string) => {
  const day = DateTime.fromISO(date).setLocale('en');

  const monthGrid = page
    .getByTestId('analytics-range-calendar')
    .getByRole('grid', { name: day.toFormat('LLLL yyyy'), exact: true });

  await monthGrid.getByRole('gridcell', { name: String(day.day), exact: true }).click();
};

const expectMemberRow = async (
  row: Locator,
  expected: { sent: string; completed: string; pending: string; completionRate: string },
) => {
  await expect(row.getByTestId('analytics-member-sent')).toHaveText(expected.sent);
  await expect(row.getByTestId('analytics-member-completed')).toHaveText(expected.completed);
  await expect(row.getByTestId('analytics-member-pending')).toHaveText(expected.pending);
  await expect(row.getByTestId('analytics-member-completion-rate')).toHaveText(expected.completionRate);
};

type AnalyticsRequestRange = { range: AnalyticsRange } | { range: 'custom'; from: string; to: string };

const requestAnalytics = async (
  page: Page,
  procedure: 'getOverview' | 'getMemberActivity' | 'getDocumentsOverTime',
  teamId: number,
  range: AnalyticsRequestRange = { range: '30d' },
  timezone = 'UTC',
) => {
  const input = encodeURIComponent(JSON.stringify({ json: { teamId, timezone, ...range } }));

  return await page.context().request.get(`${WEBAPP_BASE_URL}/api/trpc/team.analytics.${procedure}?input=${input}`);
};

const requestOverview = async (page: Page, teamId: number, range?: AnalyticsRequestRange) => {
  return await requestAnalytics(page, 'getOverview', teamId, range);
};

const requestMemberActivity = async (page: Page, teamId: number) => {
  return await requestAnalytics(page, 'getMemberActivity', teamId);
};

/**
 * Fetch documents over time in the host timezone, so bucket dates line up with
 * `daysAgoDate` and the `createdAt` of documents seeded with `daysAgo`.
 */
const requestDocumentsOverTime = async (page: Page, teamId: number, range: AnalyticsRequestRange) => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await requestAnalytics(page, 'getDocumentsOverTime', teamId, range, timezone);

  expect(response.ok()).toBe(true);

  const body: { result: { data: { json: Pick<TGetTeamAnalyticsDocumentsOverTimeResponse, 'points'> } } } =
    await response.json();

  return body.result.data.json;
};
