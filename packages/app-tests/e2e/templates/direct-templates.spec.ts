import { expect, test } from '@playwright/test';
import { customAlphabet } from 'nanoid';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createDocumentAuthOptions } from '@documenso/lib/utils/document-auth';
import { formatDirectTemplatePath } from '@documenso/lib/utils/templates';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedDirectTemplate, seedTemplate } from '@documenso/prisma/seed/templates';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

// Duped from `packages/lib/utils/teams.ts` due to errors when importing that file.
const formatDocumentsPath = (teamUrl: string) => `/t/${teamUrl}/documents`;
const formatTemplatesPath = (teamUrl: string) => `/t/${teamUrl}/templates`;

const nanoid = customAlphabet('1234567890abcdef', 10);

test('[DIRECT_TEMPLATES]: create direct link for template', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 1,
  });

  // Should be visible to team members.
  const teamTemplate = await seedTemplate({
    title: 'Team template 1',
    userId: owner.id,
    teamId: team.id,
  });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  const url = `${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/templates/${teamTemplate.id}`;

  // Owner should see list of templates with no direct link badge.
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'direct link' })).toHaveCount(1);

  // Create direct link.
  await page.getByRole('button', { name: 'Create Direct Link' }).click();
  await page.getByRole('button', { name: 'Enable direct link signing' }).click();
  await page.getByRole('button', { name: 'Create one automatically' }).click();
  await expect(page.getByRole('heading', { name: 'Direct Link Signing' })).toBeVisible();

  await page.waitForTimeout(1000);
  await page.getByTestId('btn-dialog-close').click();

  // Expect badge to appear.
  await expect(page.getByRole('button', { name: 'direct link' })).toHaveCount(2);
});

test('[DIRECT_TEMPLATES]: toggle direct template link', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 1,
  });

  // Should be visible to team members.
  const template = await seedDirectTemplate({
    title: 'Team direct template link 1',
    userId: owner.id,
    teamId: team.id,
  });

  await apiSignin({
    page,
    email: owner.email,
  });

  // Check that the direct template link is accessible.
  await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  // Navigate to template settings and disable access.
  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}${formatTemplatesPath(template.team?.url)}`);
  await page.getByRole('cell', { name: 'Use Template' }).getByRole('button').nth(1).click();
  await page.getByRole('menuitem', { name: 'Direct link' }).click();
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Direct link signing has been').first()).toBeVisible();

  // Check that the direct template link is no longer accessible.
  await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));
  await expect(page.getByText('404 not found')).toBeVisible();
});

test('[DIRECT_TEMPLATES]: delete direct template link', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 1,
  });

  // Should be visible to team members.
  const template = await seedDirectTemplate({
    title: 'Team direct template link 1',
    userId: owner.id,
    teamId: team.id,
  });

  await apiSignin({
    page,
    email: owner.email,
  });

  // Check that the direct template link is accessible.
  await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  // Navigate to template settings and delete the access.
  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}${formatTemplatesPath(template.team?.url)}`);
  await page.getByRole('cell', { name: 'Use Template' }).getByRole('button').nth(1).click();
  await page.getByRole('menuitem', { name: 'Direct link' }).click();
  await page.getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Direct template link deleted').first()).toBeVisible();

  // Check that the direct template link is no longer accessible.
  await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));
  await expect(page.getByText('404 not found')).toBeVisible();
});

test('[DIRECT_TEMPLATES]: direct template link auth access', async ({ page }) => {
  const { user, team } = await seedUser();

  const directTemplateWithAuth = await seedDirectTemplate({
    title: 'Personal direct template link',
    userId: user.id,
    teamId: team.id,
    createTemplateOptions: {
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: ['ACCOUNT'],
        globalActionAuth: [],
      }),
    },
  });

  const directTemplatePath = formatDirectTemplatePath(
    directTemplateWithAuth.directLink?.token || '',
  );

  await page.goto(directTemplatePath);

  await expect(page.getByText('Authentication required')).toBeVisible();

  await apiSignin({
    page,
    email: user.email,
  });

  await page.goto(directTemplatePath);

  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeDisabled();
});

test('[DIRECT_TEMPLATES]: use direct template link with 1 recipient', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 1,
  });

  // Should be visible to team members.
  const template = await seedDirectTemplate({
    title: 'Team direct template link 1',
    userId: owner.id,
    teamId: team.id,
  });

  // Check that the direct template link is accessible.
  await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  await page.getByPlaceholder('recipient@documenso.com').fill(seedTestEmail());

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(/\/sign/);
  await expect(page.getByRole('heading', { name: 'Document Signed' })).toBeVisible();
});
