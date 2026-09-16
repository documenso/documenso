import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin, apiSignout } from '../fixtures/authentication';
import {
  generateTotpCode,
  seedOrganisationTwoFactorEnforcement,
  seedUserTwoFactorAuthentication,
  waitForStableTotpWindow,
} from '../fixtures/two-factor';

test('[ORGANISATIONS]: joining succeeds then org context is blocked at 0-day grace', async ({ page }) => {
  const { user: owner, organisation, team } = await seedUser({ isPersonalOrganisation: false });

  // The owner must satisfy the policy themselves to use the org settings
  // pages while enforcement is active with a 0-day grace period.
  const { secret: ownerSecret } = await seedUserTwoFactorAuthentication({ userId: owner.id });

  await seedOrganisationTwoFactorEnforcement({
    organisationId: organisation.id,
    twoFactorGracePeriodDays: 0,
  });

  const { user: member } = await seedUser({ isPersonalOrganisation: false });

  await waitForStableTotpWindow();

  await apiSignin({
    page,
    email: owner.email,
    totpCode: await generateTotpCode({ secret: ownerSecret }),
    redirectPath: `/o/${organisation.url}/settings/members`,
  });

  // Invite the member while the 0-day enforcement policy is already active.
  await page.getByRole('button', { name: 'Invite member' }).click();
  await page.getByRole('textbox', { name: 'Email address *' }).fill(member.email);
  await page.getByRole('button', { name: 'Invite' }).click();

  await page.getByRole('tab', { name: 'Pending' }).click();
  await expect(page.getByText(member.email)).toBeVisible();

  // Joining is never blocked: the member accepts the invite without 2FA.
  await apiSignout({ page });
  await apiSignin({ page, email: member.email, redirectPath: `/settings/organisations` });

  await page.getByRole('button', { name: 'View invites' }).click();
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('Invitation accepted').first()).toBeVisible();

  const membership = await prisma.organisationMember.findFirst({
    where: {
      userId: member.id,
      organisationId: organisation.id,
    },
  });

  expect(membership).not.toBeNull();

  // Access, however, is blocked immediately (0-day grace): the org context
  // renders the 403 screen linking to forced enrolment.
  await page.goto(`/o/${organisation.url}`);
  await expect(page.getByRole('heading', { name: 'Two-factor authentication required' })).toBeVisible();
  await expect(page.getByText('403 Forbidden')).toBeVisible();

  const enrolmentLink = page.getByRole('link', { name: 'Set up two-factor authentication' });
  await expect(enrolmentLink).toBeVisible();
  await expect(enrolmentLink).toHaveAttribute('href', /\/onboarding\/2fa\?returnTo=/);

  // Team contexts resolve to the owning organisation and are blocked too.
  await page.goto(`/t/${team.url}/documents`);
  await expect(page.getByRole('heading', { name: 'Two-factor authentication required' })).toBeVisible();

  // The security boundary: a blocked org-scoped tRPC call returns 403.
  const blockedResponse = await page
    .context()
    .request.get(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/trpc/organisation.get?input=${encodeURIComponent(
        JSON.stringify({ json: { organisationReference: organisation.url } }),
      )}`,
    );

  expect(blockedResponse.status()).toBe(403);

  // The rest of the app stays usable: the member's own organisation is
  // unaffected.
  await page.goto(`/settings/organisations`);
  await expect(page.getByText('Two-factor authentication required')).not.toBeVisible();
});

test('[ORGANISATIONS]: member with satisfied 2FA is unaffected by enforcement', async ({ page }) => {
  const { organisation, team } = await seedUser({ isPersonalOrganisation: false });

  const memberEmail = `member-${nanoid()}@test.documenso.com`;

  const [member] = await seedOrganisationMembers({
    members: [
      {
        email: memberEmail,
        name: 'Member 2FA',
        organisationRole: 'MEMBER',
      },
    ],
    organisationId: organisation.id,
  });

  const { secret } = await seedUserTwoFactorAuthentication({ userId: member.id });

  await seedOrganisationTwoFactorEnforcement({
    organisationId: organisation.id,
    twoFactorGracePeriodDays: 0,
  });

  await waitForStableTotpWindow();

  // Signing in with a valid TOTP code marks the session as second-factor
  // verified, which satisfies enforcement.
  await apiSignin({
    page,
    email: memberEmail,
    totpCode: await generateTotpCode({ secret }),
    redirectPath: `/o/${organisation.url}`,
  });

  await expect(page.getByText(team.name).first()).toBeVisible();
  await expect(page.getByText('Two-factor authentication required')).not.toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await expect(page.getByText('Two-factor authentication required')).not.toBeVisible();

  const allowedResponse = await page
    .context()
    .request.get(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/trpc/organisation.get?input=${encodeURIComponent(
        JSON.stringify({ json: { organisationReference: organisation.url } }),
      )}`,
    );

  expect(allowedResponse.status()).toBe(200);
});

test('[ORGANISATIONS]: blocked member can leave the organisation', async ({ page }) => {
  const { organisation } = await seedUser({ isPersonalOrganisation: false });

  const memberEmail = `member-${nanoid()}@test.documenso.com`;

  const [member] = await seedOrganisationMembers({
    members: [
      {
        email: memberEmail,
        name: 'Blocked Member',
        organisationRole: 'MEMBER',
      },
    ],
    organisationId: organisation.id,
  });

  await seedOrganisationTwoFactorEnforcement({
    organisationId: organisation.id,
    twoFactorGracePeriodDays: 0,
  });

  await apiSignin({
    page,
    email: memberEmail,
    redirectPath: `/o/${organisation.url}`,
  });

  // Confirm the member is blocked from the organisation context.
  await expect(page.getByRole('heading', { name: 'Two-factor authentication required' })).toBeVisible();

  // A member must always be able to walk away: `organisation.leave` is on
  // the remediation allow-list, so leaving works while blocked.
  await page.goto('/settings/organisations');
  await page.getByRole('button', { name: 'Leave' }).click();
  await page.getByRole('button', { name: 'Leave' }).click();

  await expect(page.getByText('You have successfully left this organisation').first()).toBeVisible();
  await expect(page.getByText('No results found').first()).toBeVisible();

  const membership = await prisma.organisationMember.findFirst({
    where: {
      userId: member.id,
      organisationId: organisation.id,
    },
  });

  expect(membership).toBeNull();
});

test('[ORGANISATIONS]: admin with satisfied 2FA can enable and persist enforcement settings', async ({ page }) => {
  const { user: owner, organisation } = await seedUser({ isPersonalOrganisation: false });

  const { secret } = await seedUserTwoFactorAuthentication({ userId: owner.id });

  await waitForStableTotpWindow();

  await apiSignin({
    page,
    email: owner.email,
    totpCode: await generateTotpCode({ secret }),
    redirectPath: `/o/${organisation.url}/settings/general`,
  });

  const requireSwitch = page.getByRole('switch', { name: 'Require two-factor authentication' });

  await expect(requireSwitch).toBeVisible();
  await expect(requireSwitch).not.toBeChecked();

  await requireSwitch.click();
  await page.getByLabel('Grace period (days)').fill('30');
  await page.getByRole('button', { name: 'Update' }).click();

  await expect(page.getByText('Two-factor enforcement settings updated').first()).toBeVisible();

  // Roundtrip: values persist across a reload.
  await page.reload();

  await expect(page.getByRole('switch', { name: 'Require two-factor authentication' })).toBeChecked();
  await expect(page.getByLabel('Grace period (days)')).toHaveValue('30');

  const settings = await prisma.organisation.findFirstOrThrow({
    where: {
      id: organisation.id,
    },
    include: {
      organisationGlobalSettings: true,
    },
  });

  expect(settings.organisationGlobalSettings.twoFactorRequired).toBe(true);
  expect(settings.organisationGlobalSettings.twoFactorGracePeriodDays).toBe(30);
  expect(settings.organisationGlobalSettings.twoFactorEnforcedFrom).not.toBeNull();
});

test('[ORGANISATIONS]: admin without 2FA cannot enable enforcement', async ({ page }) => {
  const { user: owner, organisation } = await seedUser({ isPersonalOrganisation: false });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/o/${organisation.url}/settings/general`,
  });

  const requireSwitch = page.getByRole('switch', { name: 'Require two-factor authentication' });

  await expect(requireSwitch).toBeVisible();

  await requireSwitch.click();
  await page.getByRole('button', { name: 'Update' }).click();

  // Enable-time guard: the acting admin must already satisfy the policy
  // being enabled.
  await expect(
    page.getByText('You must have two-factor authentication enabled and verified on this session').first(),
  ).toBeVisible();

  const settings = await prisma.organisation.findFirstOrThrow({
    where: {
      id: organisation.id,
    },
    include: {
      organisationGlobalSettings: true,
    },
  });

  expect(settings.organisationGlobalSettings.twoFactorRequired).toBe(false);
});
