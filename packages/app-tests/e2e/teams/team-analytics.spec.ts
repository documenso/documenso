import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { prisma } from '@documenso/prisma';
import type { Prisma, User } from '@documenso/prisma/client';
import { DocumentStatus, DocumentVisibility, TeamMemberRole } from '@documenso/prisma/client';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { apiSignin, apiSignout } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const TIMEZONE = 'America/New_York';
const APRIL_DATE = '2026-04-15';
const MAY_DATE = '2026-05-15';
const SECOND_OWNER_NAME = 'Analytics Second Owner';
const HIDDEN_OWNER_NAME = 'Hidden Analytics Owner';

const APRIL_SENT_AT = new Date('2026-04-10T12:00:00.000Z');
const MAY_COMPLETED_AT = new Date('2026-05-10T12:00:00.000Z');
const MAY_DECLINED_AT = new Date('2026-05-12T12:00:00.000Z');
const MAY_CANCELLED_AT = new Date('2026-05-14T12:00:00.000Z');
const MAY_GAP_SENT_AT = new Date('2026-05-16T12:00:00.000Z');
const MAY_OTHER_OWNER_SENT_AT = new Date('2026-05-18T12:00:00.000Z');
const JUNE_RETRY_AT = new Date('2026-06-10T12:00:00.000Z');

const METRICS = ['sent', 'completed', 'declined', 'cancelled', 'draft', 'pending'] as const;

type Metric = (typeof METRICS)[number];
type MetricCounts = Record<Metric, number>;
type AuditType = (typeof DOCUMENT_AUDIT_LOG_TYPE)[keyof typeof DOCUMENT_AUDIT_LOG_TYPE];
type AuditEvent = {
  type: AuditType;
  createdAt: Date;
  data?: Prisma.InputJsonValue;
};

test.describe.configure({ mode: 'parallel' });

test('[ANALYTICS]: owner and calendar filters keep activity and current counts on their own time axes', async ({
  page,
}) => {
  const { team, owner } = await seedTeam();
  const secondOwner = await seedTeamMember({
    teamId: team.id,
    name: SECOND_OWNER_NAME,
    role: TeamMemberRole.ADMIN,
  });

  await seedAnalyticsDocument({
    owner,
    teamId: team.id,
    status: DocumentStatus.COMPLETED,
    completedAt: MAY_COMPLETED_AT,
    events: [sent(APRIL_SENT_AT), sent(MAY_COMPLETED_AT), completed(MAY_COMPLETED_AT), completed(JUNE_RETRY_AT)],
  });
  await seedAnalyticsDocument({
    owner,
    teamId: team.id,
    status: DocumentStatus.REJECTED,
    events: [sent(MAY_DECLINED_AT), declined(MAY_DECLINED_AT), declined(new Date('2026-05-13T12:00:00.000Z'))],
  });
  await seedAnalyticsDocument({
    owner,
    teamId: team.id,
    status: DocumentStatus.CANCELLED,
    completedAt: MAY_CANCELLED_AT,
    events: [sent(MAY_CANCELLED_AT), cancelled(MAY_CANCELLED_AT), cancelled(new Date('2026-05-15T12:00:00.000Z'))],
  });
  await seedAnalyticsDocument({
    owner,
    teamId: team.id,
    status: DocumentStatus.COMPLETED,
    completedAt: MAY_GAP_SENT_AT,
    events: [
      sent(MAY_GAP_SENT_AT),
      {
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED,
        createdAt: MAY_GAP_SENT_AT,
        data: { transactionId: 'rejected-completion', isRejected: true },
      },
    ],
  });
  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.DRAFT });
  await seedAnalyticsDocument({
    owner: secondOwner,
    teamId: team.id,
    status: DocumentStatus.PENDING,
    events: [sent(MAY_OTHER_OWNER_SENT_AT)],
  });
  await seedAnalyticsDocument({ owner: secondOwner, teamId: team.id, status: DocumentStatus.DRAFT });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: analyticsPath({ teamUrl: team.url, date: MAY_DATE }),
  });

  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByLabel('Period', { exact: true })).toContainText('Month');
  await expect(page.getByLabel('Date')).toHaveValue(MAY_DATE);
  await expect(page.getByText(TIMEZONE, { exact: false }).first()).toBeVisible();
  await expectMetrics(page, { sent: 4, completed: 1, declined: 1, cancelled: 1, draft: 2, pending: 1 });
  await expect(page.getByTestId('analytics-coverage')).toContainText('Completed');

  await page.getByTestId('analytics-owner-filter').click();
  await page.getByRole('option', { name: SECOND_OWNER_NAME, exact: true }).click();
  await page.keyboard.press('Escape');
  await expectAnalyticsUrl(page, {
    period: 'month',
    date: MAY_DATE,
    timezone: TIMEZONE,
    senderIds: String(secondOwner.id),
  });
  await expectMetrics(page, { sent: 1, completed: 0, declined: 0, cancelled: 0, draft: 1, pending: 1 });
  await expect(page.getByTestId('analytics-coverage')).toHaveCount(0);

  await page.getByLabel('Period', { exact: true }).click();
  await page.getByRole('option', { name: 'Day', exact: true }).click();
  await expectAnalyticsUrl(page, {
    period: 'day',
    date: MAY_DATE,
    timezone: TIMEZONE,
    senderIds: String(secondOwner.id),
  });
  await expectMetrics(page, { sent: 0, completed: 0, declined: 0, cancelled: 0, draft: 1, pending: 1 });

  await page.getByLabel('Date').fill('2026-05-18');
  await expectAnalyticsUrl(page, {
    period: 'day',
    date: '2026-05-18',
    timezone: TIMEZONE,
    senderIds: String(secondOwner.id),
  });
  await expectMetrics(page, { sent: 1, completed: 0, declined: 0, cancelled: 0, draft: 1, pending: 1 });

  await page.getByLabel('Period', { exact: true }).click();
  await page.getByRole('option', { name: 'Month', exact: true }).click();
  await page.getByRole('button', { name: 'Previous period' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('date')?.slice(0, 7)).toBe('2026-04');
  await expect(page.getByLabel('Date')).toHaveValue('2026-04-01');
  await expectMetrics(page, { sent: 0, completed: 0, declined: 0, cancelled: 0, draft: 1, pending: 1 });

  await page.getByRole('button', { name: 'Next period' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('date')?.slice(0, 7)).toBe('2026-05');
  await expect(page.getByLabel('Date')).toHaveValue('2026-05-01');
  await expectMetrics(page, { sent: 1, completed: 0, declined: 0, cancelled: 0, draft: 1, pending: 1 });
  await page.getByLabel('Date').fill('2026-05-18');

  await page.getByTestId('analytics-owner-filter').click();
  await page.getByRole('option', { name: 'All', exact: true }).click();
  await page.keyboard.press('Escape');
  await expectAnalyticsUrl(page, {
    period: 'month',
    date: '2026-05-18',
    timezone: TIMEZONE,
    senderIds: null,
  });
  await expectMetrics(page, { sent: 4, completed: 1, declined: 1, cancelled: 1, draft: 2, pending: 1 });

  const savedUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(savedUrl);
  await expect(page.getByLabel('Period', { exact: true })).toContainText('Month');
  await expect(page.getByLabel('Date')).toHaveValue('2026-05-18');
  await expectMetrics(page, { sent: 4, completed: 1, declined: 1, cancelled: 1, draft: 2, pending: 1 });

  const savedLocation = new URL(savedUrl);
  const savedPath = `${savedLocation.pathname}${savedLocation.search}`;
  await apiSignout({ page });
  await apiSignin({ page, email: secondOwner.email, redirectPath: savedPath });
  await expectAnalyticsUrl(page, {
    period: 'month',
    date: '2026-05-18',
    timezone: TIMEZONE,
    senderIds: null,
  });
  await expectMetrics(page, { sent: 4, completed: 1, declined: 1, cancelled: 1, draft: 2, pending: 1 });
});

test('[ANALYTICS]: a late response cannot replace the active calendar result', async ({ page }) => {
  const { team, owner } = await seedTeam();

  await seedAnalyticsDocument({
    owner,
    teamId: team.id,
    status: DocumentStatus.PENDING,
    events: [sent(APRIL_SENT_AT)],
  });
  await seedAnalyticsDocument({
    owner,
    teamId: team.id,
    status: DocumentStatus.PENDING,
    events: [sent(MAY_COMPLETED_AT)],
  });
  await seedAnalyticsDocument({
    owner,
    teamId: team.id,
    status: DocumentStatus.PENDING,
    events: [sent(MAY_DECLINED_AT)],
  });

  let releaseMay: () => void = () => undefined;
  let markMayReceived: () => void = () => undefined;
  let markMayReleased: () => void = () => undefined;
  const mayRelease = new Promise<void>((resolve) => {
    releaseMay = () => resolve();
  });
  const mayReceived = new Promise<void>((resolve) => {
    markMayReceived = () => resolve();
  });
  const mayReleased = new Promise<void>((resolve) => {
    markMayReleased = () => resolve();
  });
  let heldMay = false;

  await page.route('**/api/trpc/team.getAnalytics?**', async (route) => {
    const input = new URL(route.request().url()).searchParams.get('input');

    if (!heldMay && input?.includes(`"date":"${MAY_DATE}"`)) {
      heldMay = true;
      const response = await route.fetch();
      markMayReceived();
      await mayRelease;
      await route.fulfill({ response });
      markMayReleased();
      return;
    }

    await route.continue();
  });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: analyticsPath({ teamUrl: team.url, date: MAY_DATE }),
  });
  await mayReceived;

  for (const metric of METRICS) {
    await expect(page.getByTestId(`analytics-${metric}`)).toHaveCount(0);
  }

  await page.getByLabel('Date').fill(APRIL_DATE);
  await expectAnalyticsUrl(page, { period: 'month', date: APRIL_DATE, timezone: TIMEZONE });
  await expectMetrics(page, { sent: 1, completed: 0, declined: 0, cancelled: 0, draft: 0, pending: 3 });

  releaseMay();
  await mayReleased;

  await expectAnalyticsUrl(page, { period: 'month', date: APRIL_DATE, timezone: TIMEZONE });
  await expectMetrics(page, { sent: 1, completed: 0, declined: 0, cancelled: 0, draft: 0, pending: 3 });
});

test('[ANALYTICS]: a manager sees only permitted documents and cannot query another team', async ({ page }) => {
  const { team, owner } = await seedTeam();
  const manager = await seedTeamMember({
    teamId: team.id,
    name: 'Analytics Manager',
    role: TeamMemberRole.MANAGER,
  });
  const { user: hiddenOwner, team: foreignTeam } = await seedUser({ name: HIDDEN_OWNER_NAME });

  await seedAnalyticsDocument({
    owner,
    teamId: team.id,
    status: DocumentStatus.PENDING,
    visibility: DocumentVisibility.EVERYONE,
    events: [sent(MAY_COMPLETED_AT)],
  });
  await seedAnalyticsDocument({
    owner: manager,
    teamId: team.id,
    status: DocumentStatus.PENDING,
    visibility: DocumentVisibility.ADMIN,
    events: [sent(MAY_DECLINED_AT)],
  });
  await seedAnalyticsDocument({
    owner: hiddenOwner,
    teamId: team.id,
    status: DocumentStatus.COMPLETED,
    visibility: DocumentVisibility.ADMIN,
    completedAt: MAY_CANCELLED_AT,
    events: [sent(MAY_CANCELLED_AT)],
  });

  await apiSignin({
    page,
    email: manager.email,
    redirectPath: analyticsPath({ teamUrl: team.url, date: MAY_DATE }),
  });

  await expectMetrics(page, { sent: 2, completed: 0, declined: 0, cancelled: 0, draft: 0, pending: 2 });
  await expect(page.getByTestId('analytics-coverage')).toHaveCount(0);

  await page.getByTestId('analytics-owner-filter').click();
  await expect(page.getByRole('option', { name: HIDDEN_OWNER_NAME, exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');

  const ownTeamResponse = await requestAnalytics(page, { teamId: team.id, date: MAY_DATE });
  expect(ownTeamResponse.ok()).toBe(true);

  const foreignTeamResponse = await requestAnalytics(page, { teamId: foreignTeam.id, date: MAY_DATE });
  expect(foreignTeamResponse.status()).toBe(401);
  expect(await foreignTeamResponse.text()).not.toContain('"activity"');
});

test('[ANALYTICS]: an unauthenticated caller and a team member cannot access analytics', async ({ page }) => {
  const { team } = await seedTeam();
  const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  const unauthenticatedResponse = await requestAnalytics(page, { teamId: team.id, date: MAY_DATE });
  expect(unauthenticatedResponse.status()).toBe(401);
  expect(await unauthenticatedResponse.text()).not.toContain('"activity"');

  await apiSignin({ page, email: member.email });

  const memberResponse = await requestAnalytics(page, { teamId: team.id, date: MAY_DATE });
  expect(memberResponse.status()).toBe(401);
  expect(await memberResponse.text()).not.toContain('"activity"');

  await page.goto(analyticsPath({ teamUrl: team.url, date: MAY_DATE }));
  await page.waitForURL(new RegExp(`/t/${team.url}/documents(?:\\?.*)?$`));
  expect(page.url()).not.toContain('/analytics');

  await apiSignout({ page });
});

test('[ANALYTICS]: a personal team uses the same dashboard', async ({ page }) => {
  const { user, team } = await seedUser({ isPersonalOrganisation: true });

  await seedAnalyticsDocument({
    owner: user,
    teamId: team.id,
    status: DocumentStatus.PENDING,
    events: [sent(MAY_COMPLETED_AT)],
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: analyticsPath({ teamUrl: team.url, date: MAY_DATE }),
  });

  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expectMetrics(page, { sent: 1, completed: 0, declined: 0, cancelled: 0, draft: 0, pending: 1 });
});

test('[ANALYTICS]: empty states, invalid filters, and browser history remain recoverable', async ({ page }) => {
  const { team, owner } = await seedTeam();
  const emptyOwner = await seedTeamMember({
    teamId: team.id,
    name: 'Analytics Empty Owner',
    role: TeamMemberRole.ADMIN,
  });

  await seedAnalyticsDocument({ owner, teamId: team.id, status: DocumentStatus.DRAFT });
  await apiSignin({
    page,
    email: owner.email,
    redirectPath: analyticsPath({ teamUrl: team.url, date: MAY_DATE }),
  });

  await expectMetrics(page, { sent: 0, completed: 0, declined: 0, cancelled: 0, draft: 1, pending: 0 });
  await expect(page.getByTestId('analytics-empty')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Send a document', exact: true })).toHaveCount(0);

  await page.getByTestId('analytics-owner-filter').click();
  await page.getByRole('option', { name: 'Analytics Empty Owner', exact: true }).click();
  await page.keyboard.press('Escape');
  await expectAnalyticsUrl(page, {
    period: 'month',
    date: MAY_DATE,
    timezone: TIMEZONE,
    senderIds: String(emptyOwner.id),
  });
  await expectMetrics(page, { sent: 0, completed: 0, declined: 0, cancelled: 0, draft: 0, pending: 0 });
  await expect(page.getByTestId('analytics-empty')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Send a document', exact: true })).toHaveCount(0);

  await page.goBack();
  await expectAnalyticsUrl(page, { period: 'month', date: MAY_DATE, timezone: TIMEZONE });
  await expectMetrics(page, { sent: 0, completed: 0, declined: 0, cancelled: 0, draft: 1, pending: 0 });
  await expect(page.getByTestId('analytics-empty')).toBeVisible();

  await page.goForward();
  await expectAnalyticsUrl(page, {
    period: 'month',
    date: MAY_DATE,
    timezone: TIMEZONE,
    senderIds: String(emptyOwner.id),
  });
  await expectMetrics(page, { sent: 0, completed: 0, declined: 0, cancelled: 0, draft: 0, pending: 0 });
  await expect(page.getByTestId('analytics-empty')).toBeVisible();

  for (const path of [
    analyticsPath({ teamUrl: team.url, date: MAY_DATE, senderIds: [2_147_483_647] }),
    analyticsPath({ teamUrl: team.url, date: 'not-a-date' }),
    analyticsPath({ teamUrl: team.url, date: MAY_DATE, timezone: 'Not/A_Timezone' }),
  ]) {
    await page.goto(path);
    await expect(page.getByTestId('analytics-error')).toBeVisible();

    for (const metric of METRICS) {
      await expect(page.getByTestId(`analytics-${metric}`)).toHaveCount(0);
    }

    await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
    await expect(page.getByTestId('analytics-error')).toHaveCount(0);
    await expectMetrics(page, { sent: 0, completed: 0, declined: 0, cancelled: 0, draft: 1, pending: 0 });
  }
});

test('[ANALYTICS]: request and access failures clear totals and recover only when allowed', async ({ page }) => {
  const { team, owner } = await seedTeam();
  const manager = await seedTeamMember({
    teamId: team.id,
    name: 'Analytics Revoked Manager',
    role: TeamMemberRole.MANAGER,
  });

  await seedAnalyticsDocument({
    owner,
    teamId: team.id,
    status: DocumentStatus.PENDING,
    events: [sent(MAY_COMPLETED_AT)],
  });

  let failNextRequest = false;

  await page.route('**/api/trpc/team.getAnalytics?**', async (route) => {
    if (failNextRequest) {
      failNextRequest = false;
      await route.abort('failed');
      return;
    }

    await route.continue();
  });

  await apiSignin({
    page,
    email: manager.email,
    redirectPath: analyticsPath({ teamUrl: team.url, date: MAY_DATE }),
  });
  await expectMetrics(page, { sent: 1, completed: 0, declined: 0, cancelled: 0, draft: 0, pending: 1 });

  failNextRequest = true;
  await page.getByLabel('Date').fill(APRIL_DATE);
  await expect(page.getByTestId('analytics-error')).toBeVisible();

  for (const metric of METRICS) {
    await expect(page.getByTestId(`analytics-${metric}`)).toHaveCount(0);
  }

  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expectMetrics(page, { sent: 0, completed: 0, declined: 0, cancelled: 0, draft: 0, pending: 1 });
  await expect(page.getByTestId('analytics-empty')).toBeVisible();

  const managerMembership = await prisma.organisationGroupMember.findFirstOrThrow({
    where: {
      organisationMember: { userId: manager.id, organisationId: team.organisationId },
      group: { teamGroups: { some: { teamId: team.id, teamRole: TeamMemberRole.MANAGER } } },
    },
  });
  await prisma.organisationGroupMember.delete({ where: { id: managerMembership.id } });

  await page.getByLabel('Date').fill(MAY_DATE);
  await expect(page.getByTestId('analytics-error')).toBeVisible();

  for (const metric of METRICS) {
    await expect(page.getByTestId(`analytics-${metric}`)).toHaveCount(0);
  }

  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to documents', exact: true })).toBeVisible();
});

const seedAnalyticsDocument = async ({
  owner,
  teamId,
  status,
  visibility = DocumentVisibility.EVERYONE,
  completedAt,
  events = [],
}: {
  owner: User;
  teamId: number;
  status: DocumentStatus;
  visibility?: DocumentVisibility;
  completedAt?: Date;
  events?: AuditEvent[];
}) => {
  const envelope = await seedBlankDocument(owner, teamId, {
    createDocumentOptions: { status, visibility, ...(completedAt ? { completedAt } : {}) },
  });

  if (events.length > 0) {
    await prisma.documentAuditLog.createMany({
      data: events.map(({ type, createdAt, data = {} }) => ({
        envelopeId: envelope.id,
        type,
        createdAt,
        data,
      })),
    });
  }
};

const sent = (createdAt: Date): AuditEvent => ({
  type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
  createdAt,
  data: {},
});

const completed = (createdAt: Date): AuditEvent => ({
  type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED,
  createdAt,
  data: { transactionId: `completed-${createdAt.toISOString()}` },
});

const declined = (createdAt: Date): AuditEvent => ({
  type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED,
  createdAt,
  data: {
    recipientEmail: 'recipient@example.com',
    recipientName: 'Recipient',
    recipientId: 1,
    recipientRole: 'SIGNER',
    reason: 'No',
  },
});

const cancelled = (createdAt: Date): AuditEvent => ({
  type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CANCELLED,
  createdAt,
  data: { reason: 'No longer needed' },
});

const analyticsPath = ({
  teamUrl,
  date,
  period = 'month',
  timezone = TIMEZONE,
  senderIds,
}: {
  teamUrl: string;
  date: string;
  period?: 'day' | 'week' | 'month' | 'year';
  timezone?: string;
  senderIds?: number[];
}) => {
  const searchParams = new URLSearchParams({ period, date, timezone });

  if (senderIds && senderIds.length > 0) {
    searchParams.set('senderIds', senderIds.join(','));
  }

  return `/t/${teamUrl}/analytics?${searchParams.toString()}`;
};

const expectMetrics = async (page: Page, counts: MetricCounts) => {
  for (const metric of METRICS) {
    await expect(page.getByTestId(`analytics-${metric}`)).toHaveText(String(counts[metric]));
  }
};

const expectAnalyticsUrl = async (
  page: Page,
  expected: {
    period: string;
    date: string;
    timezone: string;
    senderIds?: string | null;
  },
) => {
  await expect
    .poll(() => {
      const searchParams = new URL(page.url()).searchParams;

      return {
        period: searchParams.get('period'),
        date: searchParams.get('date'),
        timezone: searchParams.get('timezone'),
        senderIds: searchParams.get('senderIds'),
      };
    })
    .toEqual({ senderIds: null, ...expected });
};

const requestAnalytics = async (page: Page, { teamId, date }: { teamId: number; date: string }) => {
  const input = encodeURIComponent(
    JSON.stringify({
      json: {
        teamId,
        period: 'month',
        date,
        timezone: TIMEZONE,
      },
    }),
  );

  return await page.context().request.get(`${WEBAPP_BASE_URL}/api/trpc/team.getAnalytics?input=${input}`, {
    headers: { 'x-team-id': String(teamId) },
  });
};
