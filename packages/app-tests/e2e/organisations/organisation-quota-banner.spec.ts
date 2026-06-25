import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { currentMonthlyPeriod } from '@documenso/lib/universal/monthly-period';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';

const BANNER_EXCEEDED_TEXT = 'Your organisation has exceeded a fair use limit';
const BANNER_NEARING_TEXT = 'Your organisation is approaching a fair use limit';

type SeedQuotaStateOptions = {
  organisationId: string;
  organisationClaimId: string;
  /**
   * The `originalSubscriptionClaimId` to set on the claim. The banner is suppressed
   * for `INTERNAL_CLAIM_ID.FREE`, so use a non-free value to make it render.
   */
  subscriptionClaimId: string;
  documentQuota: number | null;
  documentCount: number;
};

/**
 * Point the organisation's document quota and current-period usage at a known
 * state. Only the document counter is touched; email/api quotas stay `null`
 * (unlimited) so the document counter is the sole driver of the banner.
 */
const seedQuotaState = async ({
  organisationId,
  organisationClaimId,
  subscriptionClaimId,
  documentQuota,
  documentCount,
}: SeedQuotaStateOptions) => {
  await prisma.organisationClaim.update({
    where: {
      id: organisationClaimId,
    },
    data: {
      originalSubscriptionClaimId: subscriptionClaimId,
      documentQuota,
    },
  });

  const period = currentMonthlyPeriod();

  await prisma.organisationMonthlyStat.upsert({
    where: {
      organisationId_period: {
        organisationId,
        period,
      },
    },
    update: {
      documentCount,
    },
    create: {
      id: generateDatabaseId('org_monthly_stat'),
      organisationId,
      period,
      documentCount,
    },
  });
};

test('[QUOTA BANNER]: shows the approaching state when a quota is nearing', async ({ page }) => {
  const { user, organisation } = await seedUser({
    isPersonalOrganisation: false,
  });

  // ceil(10 * 0.8) = 8 → nearing, but not yet exceeded.
  await seedQuotaState({
    organisationId: organisation.id,
    organisationClaimId: organisation.organisationClaim.id,
    subscriptionClaimId: INTERNAL_CLAIM_ID.TEAM,
    documentQuota: 10,
    documentCount: 8,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/general`,
  });

  await expect(page.getByText(BANNER_NEARING_TEXT)).toBeVisible();
  await expect(page.getByText(BANNER_EXCEEDED_TEXT)).toBeHidden();
});

test('[QUOTA BANNER]: shows the exceeded state when a quota is reached', async ({ page }) => {
  const { user, organisation } = await seedUser({
    isPersonalOrganisation: false,
  });

  // usage >= quota → exceeded.
  await seedQuotaState({
    organisationId: organisation.id,
    organisationClaimId: organisation.organisationClaim.id,
    subscriptionClaimId: INTERNAL_CLAIM_ID.TEAM,
    documentQuota: 10,
    documentCount: 10,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/general`,
  });

  await expect(page.getByText(BANNER_EXCEEDED_TEXT)).toBeVisible();
  await expect(page.getByText(BANNER_NEARING_TEXT)).toBeHidden();
});

test('[QUOTA BANNER]: learn more dialog lists the affected counter', async ({ page }) => {
  const { user, organisation } = await seedUser({
    isPersonalOrganisation: false,
  });

  await seedQuotaState({
    organisationId: organisation.id,
    organisationClaimId: organisation.organisationClaim.id,
    subscriptionClaimId: INTERNAL_CLAIM_ID.TEAM,
    documentQuota: 10,
    documentCount: 10,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/general`,
  });

  await page.getByRole('button', { name: 'Learn more' }).click();

  const dialog = page.getByRole('dialog');

  await expect(dialog.getByText('Fair use limit exceeded')).toBeVisible();
  await expect(dialog.getByText('Document creation has been temporarily paused')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'support' })).toHaveAttribute('href', /^mailto:/);
});

test('[QUOTA BANNER]: is hidden for free-claim organisations', async ({ page }) => {
  const { user, organisation } = await seedUser({
    isPersonalOrganisation: false,
  });

  // Usage is exceeded, but a free-claim organisation must never see the banner.
  await seedQuotaState({
    organisationId: organisation.id,
    organisationClaimId: organisation.organisationClaim.id,
    subscriptionClaimId: INTERNAL_CLAIM_ID.FREE,
    documentQuota: 10,
    documentCount: 10,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/general`,
  });

  // Anchor on a stable element so banner-absence is meaningful (page fully loaded).
  await expect(page.getByLabel('Organisation Name*')).toBeVisible();

  await expect(page.getByText(BANNER_EXCEEDED_TEXT)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Learn more' })).toBeHidden();
});
