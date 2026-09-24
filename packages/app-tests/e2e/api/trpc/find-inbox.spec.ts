import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import {
  seedCancelledDocument,
  seedCompletedDocument,
  seedDraftDocument,
  seedPendingDocument,
} from '@documenso/prisma/seed/documents';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DocumentStatus, EnvelopeType, RecipientRole, TeamMemberRole } from '@prisma/client';

import { apiSignin, apiSignout } from '../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

type InboxFindInput = {
  query?: string;
  status?: string;
  page?: number;
  perPage?: number;
};

type InboxFindDocument = {
  envelopeId: string;
  title: string;
  status: string;
  recipients: Array<{ email: string; token: string }>;
};

/**
 * Calls `document.inbox.find` directly, bypassing any UI level restrictions so
 * we can assert the server rejects or ignores hostile input on its own.
 */
const trpcInboxFind = async (page: Page, input: InboxFindInput) => {
  const inputParam = encodeURIComponent(JSON.stringify({ json: input }));
  const url = `${WEBAPP_BASE_URL}/api/trpc/document.inbox.find?input=${inputParam}`;

  const res = await page.context().request.get(url);

  return {
    res,
    data: res.ok()
      ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ((await res.json()).result.data.json as { data: InboxFindDocument[]; count: number })
      : null,
  };
};

const titlesOf = (data: { data: InboxFindDocument[] } | null) => (data?.data ?? []).map((doc) => doc.title);

// ─── Recipient scoping ───────────────────────────────────────────────────────

test.describe('Inbox Find - Recipient Scoping', () => {
  test('should not return documents the user is not a recipient of, even when searched by title', async ({ page }) => {
    const { user: sender, team: senderTeam } = await seedUser();
    const { user: victim } = await seedUser();
    const { user: attacker } = await seedUser();

    await seedPendingDocument(sender, senderTeam.id, [victim], {
      createDocumentOptions: { title: 'Confidential Merger Agreement' },
    });

    await seedCompletedDocument(sender, senderTeam.id, [victim], {
      createDocumentOptions: { title: 'Confidential Severance Package' },
    });

    // Positive control: the actual recipient can find them.
    await apiSignin({ page, email: victim.email });

    const victimPending = await trpcInboxFind(page, { query: 'Confidential', status: 'PENDING' });
    expect(titlesOf(victimPending.data)).toEqual(['Confidential Merger Agreement']);

    const victimCompleted = await trpcInboxFind(page, { query: 'Confidential', status: 'COMPLETED' });
    expect(titlesOf(victimCompleted.data)).toEqual(['Confidential Severance Package']);

    await apiSignout({ page });

    // The attacker knows the exact title but is not a recipient.
    await apiSignin({ page, email: attacker.email });

    for (const status of ['PENDING', 'COMPLETED', undefined]) {
      const { res, data } = await trpcInboxFind(page, { query: 'Confidential', status });

      expect(res.ok()).toBeTruthy();
      expect(data?.count).toBe(0);
      expect(titlesOf(data)).toEqual([]);
    }

    await apiSignout({ page });
  });

  test('should not return documents where the user is only a CC recipient', async ({ page }) => {
    const { user: sender, team: senderTeam } = await seedUser();
    const { user: recipient } = await seedUser();

    const ccDocument = await seedPendingDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'CC Only Contract' },
    });

    await prisma.recipient.updateMany({
      where: { envelopeId: ccDocument.id, email: recipient.email },
      data: { role: RecipientRole.CC },
    });

    // Positive control on the same account.
    await seedPendingDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Signer Contract' },
    });

    await apiSignin({ page, email: recipient.email });

    const unfiltered = await trpcInboxFind(page, {});
    expect(titlesOf(unfiltered.data)).toEqual(['Signer Contract']);

    const searched = await trpcInboxFind(page, { query: 'CC Only' });
    expect(titlesOf(searched.data)).toEqual([]);

    await apiSignout({ page });
  });

  test('should not expose team documents to team members who are not recipients', async ({ page }) => {
    const { team, owner } = await seedTeam();
    const { user: outsideRecipient } = await seedUser();

    // A team admin can see this document on the team documents page, but the
    // inbox is strictly recipient scoped.
    const teamAdmin = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });

    await seedPendingDocument(owner, team.id, [outsideRecipient], {
      createDocumentOptions: { title: 'Team Payroll Summary' },
    });

    await seedCompletedDocument(owner, team.id, [outsideRecipient], {
      createDocumentOptions: { title: 'Team Board Minutes' },
    });

    await apiSignin({ page, email: teamAdmin.email });

    const pending = await trpcInboxFind(page, { query: 'Team', status: 'PENDING' });
    expect(titlesOf(pending.data)).toEqual([]);

    const completed = await trpcInboxFind(page, { query: 'Team', status: 'COMPLETED' });
    expect(titlesOf(completed.data)).toEqual([]);

    await apiSignout({ page });

    // The document owner is also not a recipient, so it should not be in their inbox either.
    await apiSignin({ page, email: owner.email });

    const ownerResult = await trpcInboxFind(page, { query: 'Team' });
    expect(titlesOf(ownerResult.data)).toEqual([]);

    await apiSignout({ page });
  });

  test('should mask signing tokens of other recipients', async ({ page }) => {
    const { user: sender, team: senderTeam } = await seedUser();
    const { user: recipient } = await seedUser();
    const { user: otherRecipient } = await seedUser();

    await seedPendingDocument(sender, senderTeam.id, [recipient, otherRecipient], {
      createDocumentOptions: { title: 'Shared Token Document' },
    });

    await apiSignin({ page, email: recipient.email });

    const { data } = await trpcInboxFind(page, { query: 'Shared Token', status: 'PENDING' });

    expect(data?.data).toHaveLength(1);

    const document = data?.data[0];

    const ownRecipient = document?.recipients.find((r) => r.email === recipient.email);
    const foreignRecipient = document?.recipients.find((r) => r.email === otherRecipient.email);

    expect(ownRecipient?.token).toBeTruthy();
    expect(foreignRecipient?.token).toBe('');

    await apiSignout({ page });
  });
});

// ─── Search hardening ────────────────────────────────────────────────────────

test.describe('Inbox Find - Search Hardening', () => {
  test('should keep wildcard searches scoped to the recipient inbox', async ({ page }) => {
    // SQL LIKE wildcards ("%" and "_") are intentionally passed through so
    // users can do advanced searches. That must only ever widen the title
    // match, never the recipient scoping.
    const { user: sender, team: senderTeam } = await seedUser();
    const { user: victim } = await seedUser();
    const { user: attacker } = await seedUser();

    await seedPendingDocument(sender, senderTeam.id, [victim], {
      createDocumentOptions: { title: 'Victim Alpha Report' },
    });

    await seedCompletedDocument(sender, senderTeam.id, [victim], {
      createDocumentOptions: { title: 'Victim Beta Report' },
    });

    // The attacker has one document of their own so we can prove wildcards
    // return their inbox and nothing more.
    await seedPendingDocument(sender, senderTeam.id, [attacker], {
      createDocumentOptions: { title: 'Attacker Own Report' },
    });

    const wildcardQueries = ['%', '_', '%%%', '%Report%', 'Victim%', 'Victim _lpha%', '\\', '%victim%'];

    // Positive control: wildcards work for the actual recipient.
    await apiSignin({ page, email: victim.email });

    const victimAll = await trpcInboxFind(page, { query: '%' });
    expect(titlesOf(victimAll.data).sort()).toEqual(['Victim Alpha Report', 'Victim Beta Report']);

    const victimPattern = await trpcInboxFind(page, { query: 'Victim _lpha%' });
    expect(titlesOf(victimPattern.data)).toEqual(['Victim Alpha Report']);

    await apiSignout({ page });

    // The attacker gets exactly their own inbox for every wildcard, never the victim's.
    await apiSignin({ page, email: attacker.email });

    for (const query of wildcardQueries) {
      const { res, data } = await trpcInboxFind(page, { query });

      expect(res.ok(), `query "${query}"`).toBeTruthy();

      const titles = titlesOf(data);

      expect(titles, `query "${query}"`).not.toContain('Victim Alpha Report');
      expect(titles, `query "${query}"`).not.toContain('Victim Beta Report');
      expect(
        titles.every((title) => title === 'Attacker Own Report'),
        `query "${query}"`,
      ).toBe(true);
    }

    // Wildcards combined with the status filter still cannot escape the scope.
    for (const status of ['PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED']) {
      const { data } = await trpcInboxFind(page, { query: '%', status });

      expect(titlesOf(data), `status "${status}"`).not.toContain('Victim Alpha Report');
      expect(titlesOf(data), `status "${status}"`).not.toContain('Victim Beta Report');
    }

    await apiSignout({ page });
  });

  test('should only match against the document title', async ({ page }) => {
    // Explicit names so the negative queries below are deterministic.
    const { user: sender, team: senderTeam } = await seedUser({ name: 'Sender Person' });
    const { user: recipient } = await seedUser({ name: 'Recipient Person' });

    await seedPendingDocument(sender, senderTeam.id, ['zebra-person@test.documenso.com', recipient], {
      createDocumentOptions: {
        title: 'Plain Title',
        externalId: 'ext-hidden-identifier',
      },
    });

    await apiSignin({ page, email: recipient.email });

    // Positive control.
    const byTitle = await trpcInboxFind(page, { query: 'Plain' });
    expect(titlesOf(byTitle.data)).toEqual(['Plain Title']);

    // External IDs, sender details and other recipients must not be probeable
    // through the inbox search.
    for (const query of ['ext-hidden', sender.email, 'Sender Person', 'zebra-person']) {
      const { data } = await trpcInboxFind(page, { query });

      expect(titlesOf(data), `query "${query}"`).toEqual([]);
    }

    await apiSignout({ page });
  });

  test('should not surface deleted, draft or template envelopes through search', async ({ page }) => {
    const { user: sender, team: senderTeam } = await seedUser();
    const { user: recipient } = await seedUser();

    const deletedDocument = await seedPendingDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Hidden Deleted Document' },
    });

    await prisma.envelope.update({
      where: { id: deletedDocument.id },
      data: { deletedAt: new Date() },
    });

    await seedDraftDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Hidden Draft Document' },
    });

    await seedPendingDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Hidden Template Envelope', type: EnvelopeType.TEMPLATE },
    });

    // Positive control.
    await seedPendingDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Hidden Visible Document' },
    });

    await apiSignin({ page, email: recipient.email });

    const unfiltered = await trpcInboxFind(page, { query: 'Hidden' });
    expect(titlesOf(unfiltered.data)).toEqual(['Hidden Visible Document']);

    for (const query of ['Hidden Deleted', 'Hidden Draft', 'Hidden Template']) {
      const { data } = await trpcInboxFind(page, { query });
      expect(titlesOf(data)).toEqual([]);
    }

    await apiSignout({ page });
  });
});

// ─── Status filter hardening ─────────────────────────────────────────────────

test.describe('Inbox Find - Status Filter Hardening', () => {
  test('should reject draft and virtual status values', async ({ page }) => {
    const { user: sender, team: senderTeam } = await seedUser();
    const { user: recipient } = await seedUser();

    // A recipient on a draft must never be able to pull it out via the status filter.
    await seedDraftDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Unsent Draft Document' },
    });

    await apiSignin({ page, email: recipient.email });

    for (const status of ['DRAFT', 'EXPIRED', 'INBOX', 'ALL', 'pending', 'draft', '']) {
      const { res, data } = await trpcInboxFind(page, { status });

      expect(res.status(), `status "${status}" should be rejected`).toBe(400);
      expect(data).toBeNull();
    }

    // Sanity check that the valid filters, and the unfiltered view, never include the draft.
    for (const status of ['PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED', undefined]) {
      const { res, data } = await trpcInboxFind(page, { status });

      expect(res.ok(), `status "${status}" should be accepted`).toBeTruthy();
      expect(titlesOf(data)).toEqual([]);
    }

    await apiSignout({ page });
  });

  test('should scope each status filter to exactly that status', async ({ page }) => {
    const { user: sender, team: senderTeam } = await seedUser();
    const { user: recipient } = await seedUser();

    await seedPendingDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Scoped Pending Document' },
    });

    await seedCompletedDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Scoped Completed Document' },
    });

    await seedCancelledDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Scoped Cancelled Document' },
    });

    await seedPendingDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Scoped Rejected Document', status: DocumentStatus.REJECTED },
    });

    await apiSignin({ page, email: recipient.email });

    const expectations = [
      { status: 'PENDING', expected: ['Scoped Pending Document'] },
      { status: 'COMPLETED', expected: ['Scoped Completed Document'] },
      { status: 'CANCELLED', expected: ['Scoped Cancelled Document'] },
      { status: 'REJECTED', expected: ['Scoped Rejected Document'] },
    ];

    for (const { status, expected } of expectations) {
      const { data } = await trpcInboxFind(page, { query: 'Scoped', status });

      expect(titlesOf(data), `status "${status}"`).toEqual(expected);
    }

    await apiSignout({ page });
  });

  test('should reject pagination values outside of the allowed range', async ({ page }) => {
    const { user } = await seedUser();

    await apiSignin({ page, email: user.email });

    const tooManyPerPage = await trpcInboxFind(page, { perPage: 101 });
    expect(tooManyPerPage.res.status()).toBe(400);

    const zeroPerPage = await trpcInboxFind(page, { perPage: 0 });
    expect(zeroPerPage.res.status()).toBe(400);

    const zeroPage = await trpcInboxFind(page, { page: 0 });
    expect(zeroPage.res.status()).toBe(400);

    await apiSignout({ page });
  });
});

// ─── Authentication ──────────────────────────────────────────────────────────

test.describe('Inbox Find - Authentication', () => {
  test('should reject unauthenticated requests', async ({ page }) => {
    const { res } = await trpcInboxFind(page, { query: 'anything', status: 'PENDING' });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });
});
