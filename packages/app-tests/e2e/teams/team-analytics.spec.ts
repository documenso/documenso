import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { getTeamAnalytics } from '@documenso/lib/server-only/team/get-team-analytics';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { prisma } from '@documenso/prisma';
import {
  seedBlankDocument,
  seedCompletedDocument,
  seedDraftDocument,
  seedPendingDocument,
  seedTeamDocuments,
} from '@documenso/prisma/seed/documents';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { expect, test } from '@playwright/test';
import { DocumentStatus, TeamMemberRole } from '@prisma/client';

import { apiSignin, apiSignout } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

// Fixed, "now"-independent windows so the date-axis assertions are deterministic.
const SENT_IN_APRIL = new Date('2026-04-10T12:00:00.000Z');
const ACTIONED_IN_MAY = new Date('2026-05-10T12:00:00.000Z');

const APRIL = {
  periodStart: new Date('2026-04-01T00:00:00.000Z'),
  periodEnd: new Date('2026-05-01T00:00:00.000Z'),
};

const MAY = {
  periodStart: new Date('2026-05-01T00:00:00.000Z'),
  periodEnd: new Date('2026-06-01T00:00:00.000Z'),
};

// ─── Query semantics (no browser / dev server) ───────────────────────────────

test('[ANALYTICS]: a completed document is counted by completedAt, not createdAt', async () => {
  const { team, owner } = await seedTeam();

  // Sent in April, completed in May — the document lands on two different axes.
  await seedCompletedDocument(owner, team.id, [], {
    createDocumentOptions: {
      createdAt: SENT_IN_APRIL,
      completedAt: ACTIONED_IN_MAY,
    },
  });

  const april = await getTeamAnalytics({ userId: owner.id, teamId: team.id, ...APRIL });
  const may = await getTeamAnalytics({ userId: owner.id, teamId: team.id, ...MAY });

  // Created (and non-draft) in April → counts as Sent in April only.
  expect(april.sent).toBe(1);
  expect(april.completed).toBe(0);

  // Completed in May → counts as Completed in May only, never as Sent in May.
  expect(may.sent).toBe(0);
  expect(may.completed).toBe(1);
});

test('[ANALYTICS]: declined documents are dated from the rejection audit log', async () => {
  const { team, owner } = await seedTeam();

  // Document was created in April but only rejected in May.
  const rejected = await seedBlankDocument(owner, team.id, {
    createDocumentOptions: {
      status: DocumentStatus.REJECTED,
      createdAt: SENT_IN_APRIL,
    },
  });

  await prisma.documentAuditLog.create({
    data: {
      envelopeId: rejected.id,
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED,
      createdAt: ACTIONED_IN_MAY,
      data: {},
    },
  });

  const april = await getTeamAnalytics({ userId: owner.id, teamId: team.id, ...APRIL });
  const may = await getTeamAnalytics({ userId: owner.id, teamId: team.id, ...MAY });

  // Rejection happened in May, so April (the creation month) records no decline.
  expect(april.declined).toBe(0);
  expect(may.declined).toBe(1);
});

test('[ANALYTICS]: counts attribute by owner and aggregate across all folders', async () => {
  const { team, owner, organisation } = await seedTeam({ createTeamMembers: 1 });

  const member = organisation.members[1].user;

  const folder = await seedBlankFolder(owner, team.id);

  // Owner: one pending in the root folder, one pending nested in a folder.
  await seedPendingDocument(owner, team.id, [], {
    createDocumentOptions: { createdAt: ACTIONED_IN_MAY },
  });
  await seedPendingDocument(owner, team.id, [], {
    createDocumentOptions: { createdAt: ACTIONED_IN_MAY, folderId: folder.id },
  });

  // Member: one pending in the root folder.
  await seedPendingDocument(member, team.id, [], {
    createDocumentOptions: { createdAt: ACTIONED_IN_MAY },
  });

  // All folders are aggregated: the nested document is included.
  const everyone = await getTeamAnalytics({ userId: owner.id, teamId: team.id, ...MAY });
  expect(everyone.pending).toBe(3);

  // Attribution by owner via senderIds.
  const ownerOnly = await getTeamAnalytics({
    userId: owner.id,
    teamId: team.id,
    senderIds: [owner.id],
    ...MAY,
  });
  expect(ownerOnly.pending).toBe(2);

  const memberOnly = await getTeamAnalytics({
    userId: owner.id,
    teamId: team.id,
    senderIds: [member.id],
    ...MAY,
  });
  expect(memberOnly.pending).toBe(1);
});

test('[ANALYTICS]: "Documents Sent" excludes drafts but counts every other status', async () => {
  const { team, owner } = await seedTeam();

  await seedDraftDocument(owner, team.id, [], {
    createDocumentOptions: { createdAt: ACTIONED_IN_MAY },
  });
  await seedPendingDocument(owner, team.id, [], {
    createDocumentOptions: { createdAt: ACTIONED_IN_MAY },
  });
  await seedCompletedDocument(owner, team.id, [], {
    createDocumentOptions: { createdAt: ACTIONED_IN_MAY, completedAt: ACTIONED_IN_MAY },
  });

  const may = await getTeamAnalytics({ userId: owner.id, teamId: team.id, ...MAY });

  expect(may.draft).toBe(1);
  expect(may.pending).toBe(1);
  expect(may.completed).toBe(1);
  // Sent = non-draft created in the period (pending + completed), drafts excluded.
  expect(may.sent).toBe(2);
});

// ─── Access control + dashboard UI (requires the running dev server) ──────────

test('[ANALYTICS]: a team admin sees the dashboard and filters move the numbers', async ({ page }) => {
  const { team, teamOwner, teamMember2 } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/analytics`,
  });

  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByTestId('team-analytics-content')).toBeVisible();

  // teamMember1 (1 completed) + teamMember2 (2 pending) = 3 non-draft documents sent.
  await expect(page.getByTestId('metric-sent')).toContainText('3');

  // Filtering to teamMember2 narrows the sent count to their 2 pending documents.
  await page.locator('button').filter({ hasText: 'Sender: All' }).click();
  await page.getByRole('option', { name: teamMember2.name ?? '' }).click();
  await page.waitForURL(/senderIds/);

  await expect(page.getByTestId('metric-sent')).toContainText('2');
});

test('[ANALYTICS]: a team member is redirected away from the dashboard', async ({ page }) => {
  const { team } = await seedTeam();

  const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  await apiSignin({
    page,
    email: member.email,
    redirectPath: `/t/${team.url}/analytics`,
  });

  // The loader silently redirects members back to documents (no 403, no leak).
  await page.waitForURL(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/documents`);

  expect(page.url()).toContain(`/t/${team.url}/documents`);
  expect(page.url()).not.toContain('/analytics');

  await apiSignout({ page });
});

test('[ANALYTICS]: a team with no document activity shows the empty state', async ({ page }) => {
  const { team, owner } = await seedTeam();

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/analytics`,
  });

  await expect(page.getByTestId('team-analytics-empty')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Send a document' })).toBeVisible();
  await expect(page.getByTestId('team-analytics-content')).toHaveCount(0);
});
