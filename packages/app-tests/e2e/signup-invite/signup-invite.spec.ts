import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';
import { SignupInviteStatus } from '@prisma/client';
import { nanoid } from 'nanoid';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const SIGNUP_INVITE_SECRET = process.env.NEXT_PRIVATE_SIGNUP_INVITE_SECRET ?? 'test-signup-invite-secret';

test.describe('Signup invite API', () => {
  test('should reject requests without a secret', async ({ request }) => {
    const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/signup-invites`, {
      data: {
        email: `missing-secret-${Date.now()}@example.com`,
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should create, inspect, and revoke a signup invite', async ({ request }) => {
    const email = `signup-invite-${Date.now()}@example.com`;

    const createResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/signup-invites`, {
      headers: {
        Authorization: `Bearer ${SIGNUP_INVITE_SECRET}`,
      },
      data: {
        email,
        expiresInDays: 7,
      },
    });

    expect(createResponse.ok()).toBeTruthy();

    const createdInvite = await createResponse.json();

    expect(createdInvite.email).toBe(email.toLowerCase());
    expect(createdInvite.status).toBe('PENDING');
    expect(createdInvite.inviteUrl).toContain(`/signup-invite/${createdInvite.token}`);

    const getResponse = await request.get(`${WEBAPP_BASE_URL}/api/internal/signup-invites/${createdInvite.token}`, {
      headers: {
        Authorization: SIGNUP_INVITE_SECRET,
      },
    });

    expect(getResponse.ok()).toBeTruthy();

    const fetchedInvite = await getResponse.json();

    expect(fetchedInvite.email).toBe(email.toLowerCase());
    expect(fetchedInvite.status).toBe('PENDING');

    const deleteResponse = await request.delete(
      `${WEBAPP_BASE_URL}/api/internal/signup-invites/${createdInvite.token}`,
      {
        headers: {
          Authorization: `Bearer ${SIGNUP_INVITE_SECRET}`,
        },
      },
    );

    expect(deleteResponse.ok()).toBeTruthy();

    const revokedInvite = await deleteResponse.json();

    expect(revokedInvite.status).toBe('REVOKED');
  });
});

test.describe('Signup invite page', () => {
  test('should show pending invite details and locked email', async ({ page }) => {
    const email = `pending-invite-${Date.now()}@example.com`;
    const token = nanoid();
    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.signupInvite.create({
      data: {
        id: generateDatabaseId('signup_invite'),
        email,
        token,
        expiresAt,
        status: SignupInviteStatus.PENDING,
      },
    });

    await page.goto(`/signup-invite/${token}`);

    await expect(page.getByText("You've been invited to create a Documenso account")).toBeVisible();
    await expect(page.getByText('Invitation details')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText('Invited email')).toBeVisible();
    await expect(page.getByText('Expires')).toBeVisible();
    await expect(page.getByLabel('Email Address')).toHaveValue(email);
    await expect(page.getByLabel('Email Address')).toHaveAttribute('readonly', '');
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  });

  test('should show two-column layout on desktop', async ({ page }) => {
    const email = `desktop-invite-${Date.now()}@example.com`;
    const token = nanoid();
    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.signupInvite.create({
      data: {
        id: generateDatabaseId('signup_invite'),
        email,
        token,
        expiresAt,
        status: SignupInviteStatus.PENDING,
      },
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/signup-invite/${token}`);

    await expect(page.getByText("You've been invited to create a Documenso account")).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create a new account' })).toBeVisible();
  });

  test('should show expired invite state', async ({ page }) => {
    const email = `expired-invite-${Date.now()}@example.com`;
    const token = nanoid();
    const expiresAt = new Date(Date.now() - 60_000);

    await prisma.signupInvite.create({
      data: {
        id: generateDatabaseId('signup_invite'),
        email,
        token,
        expiresAt,
        status: SignupInviteStatus.PENDING,
      },
    });

    await page.goto(`/signup-invite/${token}`);

    await expect(page.getByText('Invitation expired')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test('should show revoked invite state', async ({ page }) => {
    const email = `revoked-invite-${Date.now()}@example.com`;
    const token = nanoid();

    await prisma.signupInvite.create({
      data: {
        id: generateDatabaseId('signup_invite'),
        email,
        token,
        expiresAt: new Date(Date.now() + 86_400_000),
        status: SignupInviteStatus.REVOKED,
      },
    });

    await page.goto(`/signup-invite/${token}`);

    await expect(page.getByText('Invitation revoked')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });
});
