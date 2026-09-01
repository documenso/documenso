import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { ORGANISATION_USER_ACCOUNT_TYPE } from '@documenso/lib/constants/organisations';
import { getUserByEmail } from '@documenso/lib/server-only/user/get-user-by-email';
import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import type { User } from '@documenso/prisma/client';
import { DocumentStatus, EnvelopeType, SubscriptionStatus } from '@documenso/prisma/client';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

/**
 * The deleted-account service account is where orphaned DOCUMENT envelopes land
 * when the team/org they belong to is torn down. It is created by a migration so
 * it always exists in the test database.
 */
const getDeletedServiceAccount = async () => {
  const deletedAccount = await prisma.user.findFirstOrThrow({
    where: { email: { startsWith: 'deleted-account@' } },
    select: {
      id: true,
      ownedOrganisations: { select: { teams: { select: { id: true } } } },
    },
  });

  return {
    id: deletedAccount.id,
    teamId: deletedAccount.ownedOrganisations[0].teams[0].id,
  };
};

/**
 * Drives the account deletion through the settings UI, exactly as a user would.
 * Returns once the app has redirected to the sign-in page (deletion is performed
 * synchronously by the `profile.deleteAccount` mutation before the redirect).
 */
const deleteAccountViaUi = async (page: Page, email: string) => {
  await apiSignin({ page, email, redirectPath: '/settings' });

  await page.getByRole('button', { name: 'Delete Account' }).click();
  await page.getByLabel('Confirm Email').fill(email);

  await expect(page.getByRole('button', { name: 'Confirm Deletion' })).not.toBeDisabled();
  await page.getByRole('button', { name: 'Confirm Deletion' }).click();

  await page.waitForURL(`${WEBAPP_BASE_URL}/signin`);
};

const seedDocumentWithStatus = async (sender: User, teamId: number, key: string, status: DocumentStatus) => {
  const document = await seedBlankDocument(sender, teamId, { key });

  if (status !== DocumentStatus.DRAFT) {
    await prisma.envelope.update({
      where: { id: document.id },
      data: { status },
    });
  }

  return document;
};

const waitForOrganisationToBeGone = async (organisationId: string) => {
  await expect
    .poll(
      async () => {
        const org = await prisma.organisation.findUnique({
          where: { id: organisationId },
          select: { id: true },
        });

        return org === null;
      },
      {
        message: `Organisation ${organisationId} was not removed after account deletion`,
        timeout: 15_000,
        intervals: [250, 500, 1000],
      },
    )
    .toBe(true);
};

// ─── Happy path: the basic flow still works ──────────────────────────────────

test('[USER] delete account', async ({ page }) => {
  const { user } = await seedUser();

  await deleteAccountViaUi(page, user.email);

  // Verify that the user no longer exists in the database.
  await expect(getUserByEmail({ email: user.email })).rejects.toThrow();
});

// ─── Owned organisation: documents orphaned to the service account ───────────

test('[USER][DELETE_ACCOUNT]: owned org docs are orphaned to service account, drafts and templates removed', async ({
  page,
}) => {
  const { user, organisation, team } = await seedUser();

  // Inflight/completed DOCUMENT envelopes that must survive as orphans.
  const completed = await seedDocumentWithStatus(user, team.id, 'owned-completed', DocumentStatus.COMPLETED);
  const pending = await seedDocumentWithStatus(user, team.id, 'owned-pending', DocumentStatus.PENDING);
  const rejected = await seedDocumentWithStatus(user, team.id, 'owned-rejected', DocumentStatus.REJECTED);

  // A draft DOCUMENT — orphan only re-parents PENDING/REJECTED/COMPLETED, so it is hard-deleted.
  const draft = await seedDocumentWithStatus(user, team.id, 'owned-draft', DocumentStatus.DRAFT);

  // A TEMPLATE — orphan only re-parents DOCUMENT envelopes, so it is hard-deleted.
  const template = await seedBlankDocument(user, team.id, { key: 'owned-template' });
  await prisma.envelope.update({
    where: { id: template.id },
    data: { type: EnvelopeType.TEMPLATE },
  });

  expect(await prisma.envelope.count({ where: { teamId: team.id } })).toBe(5);

  await deleteAccountViaUi(page, user.email);

  await waitForOrganisationToBeGone(organisation.id);

  const service = await getDeletedServiceAccount();

  // Completed/pending/rejected: re-parented to the service account + soft-deleted.
  for (const original of [completed, pending, rejected]) {
    const after = await prisma.envelope.findUnique({
      where: { id: original.id },
      select: { id: true, teamId: true, userId: true, deletedAt: true },
    });

    expect(after, `envelope ${original.id} should survive as an orphan`).not.toBeNull();
    expect(after?.teamId).toBe(service.teamId);
    expect(after?.userId).toBe(service.id);
    expect(after?.deletedAt).not.toBeNull();
  }

  // Draft + template are hard-deleted.
  expect(await prisma.envelope.findUnique({ where: { id: draft.id } })).toBeNull();
  expect(await prisma.envelope.findUnique({ where: { id: template.id } })).toBeNull();

  // The owned org, its team, and the user are gone. Nothing references the old team.
  expect(await prisma.organisation.findUnique({ where: { id: organisation.id } })).toBeNull();
  expect(await prisma.team.findUnique({ where: { id: team.id } })).toBeNull();
  expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  expect(await prisma.envelope.count({ where: { teamId: team.id } })).toBe(0);
});

// ─── Member of another org: documents transferred to the OWNER, not deleted ──

test('[USER][DELETE_ACCOUNT]: docs in orgs the user is a member of are transferred to the org owner', async ({
  page,
}) => {
  // Another org, owned by someone else, that the deleted user is merely a member of.
  const { user: ownerB, organisation: orgB, team: teamB } = await seedUser();

  // The account being deleted. They own their own (personal) org too.
  const { user: userA, organisation: orgA, team: teamA } = await seedUser();

  await seedOrganisationMembers({
    organisationId: orgB.id,
    members: [{ email: userA.email, name: userA.name ?? 'User A', organisationRole: 'MEMBER' }],
  });

  // userA authors envelopes inside orgB's team (both completed and draft).
  const memberCompleted = await seedDocumentWithStatus(userA, teamB.id, 'member-completed', DocumentStatus.COMPLETED);
  const memberDraft = await seedDocumentWithStatus(userA, teamB.id, 'member-draft', DocumentStatus.DRAFT);

  // userA also has a completed doc in their OWN org (should orphan to service account).
  const ownedCompleted = await seedDocumentWithStatus(userA, teamA.id, 'owned-completed', DocumentStatus.COMPLETED);

  await deleteAccountViaUi(page, userA.email);

  await waitForOrganisationToBeGone(orgA.id);

  const service = await getDeletedServiceAccount();

  // Member-org envelopes — regardless of status — are reassigned to orgB's owner,
  // stay in orgB's team, and are NOT soft-deleted.
  for (const original of [memberCompleted, memberDraft]) {
    const after = await prisma.envelope.findUnique({
      where: { id: original.id },
      select: { id: true, teamId: true, userId: true, deletedAt: true },
    });

    expect(after, `member envelope ${original.id} should be transferred, not deleted`).not.toBeNull();
    expect(after?.teamId).toBe(teamB.id);
    expect(after?.userId).toBe(ownerB.id);
    expect(after?.deletedAt).toBeNull();
  }

  // The other org and its owner survive — only the deleted user's own org is removed.
  expect(await prisma.organisation.findUnique({ where: { id: orgB.id } })).not.toBeNull();
  expect(await prisma.user.findUnique({ where: { id: ownerB.id } })).not.toBeNull();

  // The deleted user's own completed doc was orphaned to the service account.
  const ownedAfter = await prisma.envelope.findUnique({
    where: { id: ownedCompleted.id },
    select: { teamId: true, userId: true, deletedAt: true },
  });
  expect(ownedAfter, 'owned-org envelope should survive as an orphan').not.toBeNull();
  expect(ownedAfter?.teamId).toBe(service.teamId);
  expect(ownedAfter?.userId).toBe(service.id);
  expect(ownedAfter?.deletedAt).not.toBeNull();

  // userA is gone.
  expect(await prisma.user.findUnique({ where: { id: userA.id } })).toBeNull();
});

// ─── Owned org with members: org torn down, members survive, their docs orphaned ─

test('[USER][DELETE_ACCOUNT]: deleting the owner removes the org but keeps members and orphans their docs', async ({
  page,
}) => {
  const { user: owner, organisation, team } = await seedUser();

  const [member] = await seedOrganisationMembers({
    organisationId: organisation.id,
    members: [{ organisationRole: 'MEMBER' }],
  });

  // A member (not the owner) authored a completed doc inside the owned org's team.
  // The orphan logic filters by teamId only, so this must be orphaned too.
  const memberCompleted = await seedDocumentWithStatus(member, team.id, 'member-completed', DocumentStatus.COMPLETED);

  await deleteAccountViaUi(page, owner.email);

  await waitForOrganisationToBeGone(organisation.id);

  const service = await getDeletedServiceAccount();

  const after = await prisma.envelope.findUnique({
    where: { id: memberCompleted.id },
    select: { teamId: true, userId: true, deletedAt: true },
  });
  expect(after, 'member-authored envelope should survive as an orphan').not.toBeNull();
  expect(after?.teamId).toBe(service.teamId);
  expect(after?.userId).toBe(service.id);
  expect(after?.deletedAt).not.toBeNull();

  // The member user survives — only the org and its owner are removed.
  expect(await prisma.user.findUnique({ where: { id: member.id } })).not.toBeNull();
  expect(await prisma.organisation.findUnique({ where: { id: organisation.id } })).toBeNull();
  expect(await prisma.user.findUnique({ where: { id: owner.id } })).toBeNull();
});

// ─── Subscription cancellation is scheduled for owned orgs ───────────────────

test('[USER][DELETE_ACCOUNT]: a cancel-subscription job is enqueued for an owned org that has a subscription', async ({
  page,
}) => {
  const { user, organisation } = await seedUser();

  const planId = `sub_e2e_${nanoid()}`;

  await prisma.subscription.create({
    data: {
      status: SubscriptionStatus.ACTIVE,
      planId,
      priceId: `price_e2e_${nanoid()}`,
      customerId: `cus_e2e_${nanoid()}`,
      organisationId: organisation.id,
    },
  });

  await deleteAccountViaUi(page, user.email);

  await waitForOrganisationToBeGone(organisation.id);

  // The deletion must schedule the Stripe subscription cancellation job with the
  // captured planId (the Subscription row itself cascades away with the org).
  await expect
    .poll(
      async () => {
        const job = await prisma.backgroundJob.findFirst({
          where: {
            jobId: 'internal.cancel-organisation-subscription',
            payload: { path: ['organisationId'], equals: organisation.id },
          },
        });

        if (!job) {
          return null;
        }

        return (job.payload as { stripeSubscriptionId?: string }).stripeSubscriptionId ?? null;
      },
      {
        message: 'cancel-organisation-subscription job was not enqueued',
        timeout: 15_000,
        intervals: [250, 500, 1000],
      },
    )
    .toBe(planId);

  // The local Subscription row cascades away with the organisation — which is
  // exactly why the planId has to be captured into the job payload beforehand.
  expect(await prisma.subscription.findUnique({ where: { planId } })).toBeNull();
});

// ─── Owned org account (SSO) rows are cleaned up, members survive ────────────

test('[USER][DELETE_ACCOUNT]: org-linked account rows are removed when an owned org is torn down', async ({ page }) => {
  const { user: owner, organisation } = await seedUser();

  const [member] = await seedOrganisationMembers({
    organisationId: organisation.id,
    members: [{ organisationRole: 'MEMBER' }],
  });

  // Simulate a member who linked their login through the organisation's SSO.
  // These rows are keyed by `provider = organisation.id` and have no foreign key
  // to the organisation, so they must be deleted explicitly during teardown.
  const orgAccount = await prisma.account.create({
    data: {
      userId: member.id,
      type: ORGANISATION_USER_ACCOUNT_TYPE,
      provider: organisation.id,
      providerAccountId: `oidc-${nanoid()}`,
    },
  });

  await deleteAccountViaUi(page, owner.email);

  await waitForOrganisationToBeGone(organisation.id);

  // The org-linked account row is gone...
  expect(await prisma.account.findUnique({ where: { id: orgAccount.id } })).toBeNull();
  expect(
    await prisma.account.count({
      where: { type: ORGANISATION_USER_ACCOUNT_TYPE, provider: organisation.id },
    }),
  ).toBe(0);

  // ...but the member user it belonged to survives (only the org + owner are removed).
  expect(await prisma.user.findUnique({ where: { id: member.id } })).not.toBeNull();
  expect(await prisma.user.findUnique({ where: { id: owner.id } })).toBeNull();
});

// ─── Sad path: no subscription means no cancel job is enqueued ────────────────

test('[USER][DELETE_ACCOUNT]: no cancel-subscription job is enqueued when the owned org has no subscription', async ({
  page,
}) => {
  const { user, organisation } = await seedUser();

  await deleteAccountViaUi(page, user.email);

  await waitForOrganisationToBeGone(organisation.id);

  const job = await prisma.backgroundJob.findFirst({
    where: {
      jobId: 'internal.cancel-organisation-subscription',
      payload: { path: ['organisationId'], equals: organisation.id },
    },
  });

  expect(job).toBeNull();
});

// ─── Sad path: a mismatched confirmation email leaves everything intact ───────

test('[USER][DELETE_ACCOUNT]: a wrong confirmation email keeps the account, org and documents intact', async ({
  page,
}) => {
  const { user, organisation, team } = await seedUser();

  const completed = await seedDocumentWithStatus(user, team.id, 'kept-completed', DocumentStatus.COMPLETED);

  await apiSignin({ page, email: user.email, redirectPath: '/settings' });

  await page.getByRole('button', { name: 'Delete Account' }).click();
  await page.getByLabel('Confirm Email').fill('not-my-email@example.com');

  // The confirm button stays disabled while the email does not match.
  await expect(page.getByRole('button', { name: 'Confirm Deletion' })).toBeDisabled();

  // Nothing was deleted or orphaned.
  expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  expect(await prisma.organisation.findUnique({ where: { id: organisation.id } })).not.toBeNull();

  const docAfter = await prisma.envelope.findUnique({
    where: { id: completed.id },
    select: { teamId: true, userId: true, deletedAt: true },
  });
  expect(docAfter?.teamId).toBe(team.id);
  expect(docAfter?.userId).toBe(user.id);
  expect(docAfter?.deletedAt).toBeNull();
});
