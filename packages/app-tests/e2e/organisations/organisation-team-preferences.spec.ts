import { expect, test } from '@playwright/test';

import { getTeamSettings } from '@documenso/lib/server-only/team/get-team-settings';
import { prisma } from '@documenso/prisma';
import { DocumentVisibility } from '@documenso/prisma/client';
import { seedTeamDocumentWithMeta } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test('[ORGANISATIONS]: manage preferences', async ({ page }) => {
  const { user, organisation, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/org/${organisation.url}/settings/preferences`,
  });

  // Update document preferences.
  await page.getByRole('combobox').filter({ hasText: 'Everyone can access and view' }).click();
  await page.getByRole('option', { name: 'Only managers and above can' }).click();
  await page.getByRole('combobox').filter({ hasText: 'English' }).click();
  await page.getByRole('option', { name: 'German' }).click();
  await page.getByTestId('signature-types-combobox').click();
  await page.getByRole('option', { name: 'Draw' }).click();
  await page.getByRole('option', { name: 'Upload' }).click();
  await page.getByRole('combobox').nth(3).click();
  await page.getByRole('option', { name: 'No' }).click();
  await page.getByRole('combobox').filter({ hasText: 'Yes' }).click();
  await page.getByRole('option', { name: 'No' }).click();
  await page.getByRole('button', { name: 'Update' }).first().click();
  await expect(page.getByText('Your document preferences have been updated').first()).toBeVisible();

  // Update branding.
  await page.getByRole('switch', { name: 'Enable Custom Branding' }).click();
  await page.getByRole('textbox', { name: 'Brand Website' }).click();
  await page.getByRole('textbox', { name: 'Brand Website' }).fill('https://documenso.com');
  await page.getByRole('textbox', { name: 'Brand Details' }).click();
  await page.getByRole('textbox', { name: 'Brand Details' }).fill('BrandDetails');
  await page.getByRole('button', { name: 'Update' }).nth(1).click();
  await expect(page.getByText('Your branding preferences have been updated').first()).toBeVisible();

  const teamSettings = await getTeamSettings({
    teamId: team.id,
  });

  // Check that the team settings have inherited these values.
  expect(teamSettings.documentVisibility).toEqual(DocumentVisibility.MANAGER_AND_ABOVE);
  expect(teamSettings.documentLanguage).toEqual('de');
  expect(teamSettings.includeSenderDetails).toEqual(false);
  expect(teamSettings.includeSigningCertificate).toEqual(false);
  expect(teamSettings.typedSignatureEnabled).toEqual(true);
  expect(teamSettings.uploadSignatureEnabled).toEqual(false);
  expect(teamSettings.drawSignatureEnabled).toEqual(false);
  expect(teamSettings.brandingEnabled).toEqual(true);
  expect(teamSettings.brandingUrl).toEqual('https://documenso.com');
  expect(teamSettings.brandingCompanyDetails).toEqual('BrandDetails');

  // Edit the team settings
  await page.goto(`/t/${team.url}/settings/preferences`);

  await page
    .getByRole('group')
    .locator('div')
    .filter({
      hasText: 'Default Document Visibility',
    })
    .getByRole('combobox')
    .click();
  await page.getByRole('option', { name: 'Everyone can access and view' }).click();
  await page
    .getByRole('group')
    .locator('div')
    .filter({ hasText: 'Default Document Language' })
    .getByRole('combobox')
    .click();
  await page.getByRole('option', { name: 'Polish' }).click();
  await page.getByRole('button', { name: 'Update' }).first().click();
  await expect(page.getByText('Your document preferences have been updated').first()).toBeVisible();

  const updatedTeamSettings = await getTeamSettings({
    teamId: team.id,
  });

  // Check that the team settings have inherited/overriden the correct values.
  expect(updatedTeamSettings.documentVisibility).toEqual(DocumentVisibility.EVERYONE);
  expect(updatedTeamSettings.documentLanguage).toEqual('pl');
  expect(updatedTeamSettings.includeSenderDetails).toEqual(false);
  expect(updatedTeamSettings.includeSigningCertificate).toEqual(false);
  expect(updatedTeamSettings.typedSignatureEnabled).toEqual(true);
  expect(updatedTeamSettings.uploadSignatureEnabled).toEqual(false);
  expect(updatedTeamSettings.drawSignatureEnabled).toEqual(false);

  const document = await seedTeamDocumentWithMeta(team);

  const documentMeta = await prisma.documentMeta.findFirstOrThrow({
    where: {
      documentId: document.id,
    },
  });

  // Confirm the settings have been applied to a newly created document.
  expect(document.visibility).toEqual(DocumentVisibility.EVERYONE);

  expect(documentMeta.typedSignatureEnabled).toEqual(true);
  expect(documentMeta.uploadSignatureEnabled).toEqual(false);
  expect(documentMeta.drawSignatureEnabled).toEqual(false);
  expect(documentMeta.language).toEqual('pl');
});
