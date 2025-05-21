import { expect, test } from '@playwright/test';
import { customAlphabet } from 'nanoid';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import {
  DIRECT_TEMPLATE_RECIPIENT_EMAIL,
  DIRECT_TEMPLATE_RECIPIENT_NAME,
} from '@documenso/lib/constants/direct-templates';
import { createDocumentAuthOptions } from '@documenso/lib/utils/document-auth';
import { formatDirectTemplatePath } from '@documenso/lib/utils/templates';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedDirectTemplate, seedTemplate } from '@documenso/prisma/seed/templates';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';
import { checkDocumentTabCount } from '../fixtures/documents';

// Duped from `packages/lib/utils/teams.ts` due to errors when importing that file.
const formatDocumentsPath = (teamUrl?: string) =>
  teamUrl ? `/t/${teamUrl}/documents` : '/documents';
const formatTemplatesPath = (teamUrl?: string) =>
  teamUrl ? `/t/${teamUrl}/templates` : '/templates';

const nanoid = customAlphabet('1234567890abcdef', 10);

test('[DIRECT_TEMPLATES]: create direct link for template', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  const owner = team.owner;

  // Should only be visible to the owner in personal templates.
  const personalTemplate = await seedTemplate({
    title: 'Personal template',
    userId: owner.id,
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
    redirectPath: '/templates',
  });

  const urls = [
    `${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/templates/${teamTemplate.id}`,
    `${NEXT_PUBLIC_WEBAPP_URL()}/templates/${personalTemplate.id}`,
  ];

  // Run test for personal and team templates.
  for (const url of urls) {
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
  }
});

test('[DIRECT_TEMPLATES]: toggle direct template link', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  const owner = team.owner;

  // Should only be visible to the owner in personal templates.
  const personalDirectTemplate = await seedDirectTemplate({
    title: 'Personal direct template link',
    userId: owner.id,
  });

  // Should be visible to team members.
  const teamDirectTemplate = await seedDirectTemplate({
    title: 'Team direct template link 1',
    userId: owner.id,
    teamId: team.id,
  });

  await apiSignin({
    page,
    email: owner.email,
  });

  // Run test for personal and team templates.
  for (const template of [personalDirectTemplate, teamDirectTemplate]) {
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
  }
});

test('[DIRECT_TEMPLATES]: delete direct template link', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  const owner = team.owner;

  // Should only be visible to the owner in personal templates.
  const personalDirectTemplate = await seedDirectTemplate({
    title: 'Personal direct template link',
    userId: owner.id,
  });

  // Should be visible to team members.
  const teamDirectTemplate = await seedDirectTemplate({
    title: 'Team direct template link 1',
    userId: owner.id,
    teamId: team.id,
  });

  await apiSignin({
    page,
    email: owner.email,
  });

  // Run test for personal and team templates.
  for (const template of [personalDirectTemplate, teamDirectTemplate]) {
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
  }
});

test('[DIRECT_TEMPLATES]: direct template link auth access', async ({ page }) => {
  const user = await seedUser();

  const directTemplateWithAuth = await seedDirectTemplate({
    title: 'Personal direct template link',
    userId: user.id,
    createTemplateOptions: {
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: 'ACCOUNT',
        globalActionAuth: null,
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
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  const owner = team.owner;

  // Should only be visible to the owner in personal templates.
  const personalDirectTemplate = await seedDirectTemplate({
    title: 'Personal direct template link',
    userId: owner.id,
  });

  // Should be visible to team members.
  const teamDirectTemplate = await seedDirectTemplate({
    title: 'Team direct template link 1',
    userId: owner.id,
    teamId: team.id,
  });

  // Run test for personal and team templates.
  for (const template of [personalDirectTemplate, teamDirectTemplate]) {
    // Check that the direct template link is accessible.
    await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));

    // Wait for the page to load completely before interacting with elements
    await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

    // Wait for email field to be ready
    const emailField = page.getByPlaceholder('recipient@documenso.com');
    await expect(emailField).toBeVisible();
    await expect(emailField).toBeEnabled();

    // Add a short wait to ensure the page is fully interactive
    await page.waitForTimeout(1000);

    // Fill the email field
    await emailField.fill(seedTestEmail());

    // Wait for the Continue button to be enabled before clicking
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Wait for the Complete button to appear
    const completeButton = page.getByRole('button', { name: 'Complete' });
    await expect(completeButton).toBeVisible();
    await expect(completeButton).toBeEnabled();
    await completeButton.click();

    // Wait for the Sign button to appear
    const signButton = page.getByRole('button', { name: 'Sign' });
    await expect(signButton).toBeVisible();
    await expect(signButton).toBeEnabled();
    await signButton.click();

    await page.waitForURL(/\/sign/);
    await expect(page.getByRole('heading', { name: 'Document Signed' })).toBeVisible();

    // Add a longer waiting period to ensure document status is updated
    await page.waitForTimeout(3000);
  }

  await apiSignin({
    page,
    email: owner.email,
  });

  // Check that the owner has the documents.
  for (const template of [personalDirectTemplate, teamDirectTemplate]) {
    await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}${formatDocumentsPath(template.team?.url)}`);

    await expect(async () => {
      // Check that the document is in the 'All' tab.
      await checkDocumentTabCount(page, 'Completed', 1);
    }).toPass({ timeout: 15000 });
  }
});

test('[DIRECT_TEMPLATES]: use direct template link with 2 recipients', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  const owner = team.owner;

  const secondRecipient = await seedUser();

  const createTemplateOptions = {
    recipients: {
      createMany: {
        data: [
          {
            email: DIRECT_TEMPLATE_RECIPIENT_EMAIL,
            name: DIRECT_TEMPLATE_RECIPIENT_NAME,
            token: nanoid(),
          },
          {
            email: secondRecipient.email,
            token: nanoid(),
          },
        ],
      },
    },
  };

  // Should only be visible to the owner in personal templates.
  const personalDirectTemplate = await seedDirectTemplate({
    title: 'Personal direct template link',
    userId: owner.id,
    createTemplateOptions,
  });

  // Should be visible to team members.
  const teamDirectTemplate = await seedDirectTemplate({
    title: 'Team direct template link 1',
    userId: owner.id,
    teamId: team.id,
    createTemplateOptions,
  });

  // Run test for personal and team templates.
  for (const template of [personalDirectTemplate, teamDirectTemplate]) {
    // Check that the direct template link is accessible.
    await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));

    // Wait for the page to load completely before interacting with elements
    await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

    // Wait for email field to be ready
    const emailField = page.getByPlaceholder('recipient@documenso.com');
    await expect(emailField).toBeVisible();
    await expect(emailField).toBeEnabled();

    // Add a short wait to ensure the page is fully interactive
    await page.waitForTimeout(1000);

    // Fill the email field
    await emailField.fill(seedTestEmail());

    // Wait for the Continue button to be enabled before clicking
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Wait for the Complete button to appear
    const completeButton = page.getByRole('button', { name: 'Complete' });
    await expect(completeButton).toBeVisible();
    await expect(completeButton).toBeEnabled();
    await completeButton.click();

    // Wait for the Sign button to appear
    const signButton = page.getByRole('button', { name: 'Sign' });
    await expect(signButton).toBeVisible();
    await expect(signButton).toBeEnabled();
    await signButton.click();

    await page.waitForURL(/\/sign/);
    await expect(page.getByText('Waiting for others to sign')).toBeVisible();
  }

  await apiSignin({
    page,
    email: owner.email,
  });

  // Check that the owner has the documents.
  for (const template of [personalDirectTemplate, teamDirectTemplate]) {
    await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}${formatDocumentsPath(template.team?.url)}`);

    // Check that the document is in the 'All' tab.
    await checkDocumentTabCount(page, 'All', 1);
    await checkDocumentTabCount(page, 'Pending', 1);
  }

  // Check that the second recipient has the 2 pending documents.
  await apiSignin({
    page,
    email: secondRecipient.email,
  });

  await page.goto('/documents');

  await checkDocumentTabCount(page, 'All', 2);
  await checkDocumentTabCount(page, 'Inbox', 2);
});
