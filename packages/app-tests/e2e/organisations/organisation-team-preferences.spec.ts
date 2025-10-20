import { expect, test } from '@playwright/test';

import { getTeamSettings } from '@documenso/lib/server-only/team/get-team-settings';
import { prisma } from '@documenso/prisma';
import { DocumentVisibility } from '@documenso/prisma/client';
import { seedTeamDocumentWithMeta } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test('[ORGANISATIONS]: manage document preferences', async ({ page }) => {
  const { user, organisation, team } = await seedUser({
    isPersonalOrganisation: false,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/document`,
  });

  // Update document preferences.
  await page.getByRole('combobox').filter({ hasText: 'Everyone can access and view' }).click();
  await page.getByRole('option', { name: 'Only managers and above can' }).click();
  await page.getByRole('combobox').filter({ hasText: 'English' }).click();
  await page.getByRole('option', { name: 'German' }).click();

  // Set default timezone
  await page.getByRole('combobox').filter({ hasText: 'Local timezone' }).click();
  await page.getByRole('option', { name: 'Australia/Perth' }).click();

  // Set default date
  await page.getByRole('combobox').filter({ hasText: 'yyyy-MM-dd hh:mm AM/PM' }).click();
  await page.getByRole('option', { name: 'DD/MM/YYYY', exact: true }).click();

  await page.getByTestId('signature-types-trigger').click();
  await page.getByRole('option', { name: 'Draw' }).click();
  await page.getByRole('option', { name: 'Upload' }).click();
  await page.getByTestId('include-sender-details-trigger').click();
  await page.getByRole('option', { name: 'No' }).click();
  await page.getByTestId('include-signing-certificate-trigger').click();
  await page.getByRole('option', { name: 'No' }).click();
  await page.getByRole('button', { name: 'Update' }).first().click();
  await expect(page.getByText('Your document preferences have been updated').first()).toBeVisible();

  const teamSettings = await getTeamSettings({
    teamId: team.id,
  });

  // Check that the team settings have inherited these values.
  expect(teamSettings.documentVisibility).toEqual(DocumentVisibility.MANAGER_AND_ABOVE);
  expect(teamSettings.documentLanguage).toEqual('de');
  expect(teamSettings.documentTimezone).toEqual('Australia/Perth');
  expect(teamSettings.documentDateFormat).toEqual('dd/MM/yyyy');
  expect(teamSettings.includeSenderDetails).toEqual(false);
  expect(teamSettings.includeSigningCertificate).toEqual(false);
  expect(teamSettings.typedSignatureEnabled).toEqual(true);
  expect(teamSettings.uploadSignatureEnabled).toEqual(false);
  expect(teamSettings.drawSignatureEnabled).toEqual(false);

  // Edit the team settings
  await page.goto(`/t/${team.url}/settings/document`);

  await page.getByTestId('document-visibility-trigger').click();
  await page.getByRole('option', { name: 'Everyone can access and view' }).click();
  await page.getByTestId('document-language-trigger').click();
  await page.getByRole('option', { name: 'Polish' }).click();

  // Override team timezone settings
  await page.getByTestId('document-timezone-trigger').click();
  await page.getByRole('option', { name: 'Europe/London' }).click();

  // Override team date format settings
  await page.getByTestId('document-date-format-trigger').click();
  await page.getByRole('option', { name: 'MM/DD/YYYY', exact: true }).click();

  await page.getByRole('button', { name: 'Update' }).first().click();
  await expect(page.getByText('Your document preferences have been updated').first()).toBeVisible();

  const updatedTeamSettings = await getTeamSettings({
    teamId: team.id,
  });

  // Check that the team settings have inherited/overriden the correct values.
  expect(updatedTeamSettings.documentVisibility).toEqual(DocumentVisibility.EVERYONE);
  expect(updatedTeamSettings.documentLanguage).toEqual('pl');
  expect(updatedTeamSettings.documentTimezone).toEqual('Europe/London');
  expect(updatedTeamSettings.documentDateFormat).toEqual('MM/dd/yyyy');
  expect(updatedTeamSettings.includeSenderDetails).toEqual(false);
  expect(updatedTeamSettings.includeSigningCertificate).toEqual(false);
  expect(updatedTeamSettings.typedSignatureEnabled).toEqual(true);
  expect(updatedTeamSettings.uploadSignatureEnabled).toEqual(false);
  expect(updatedTeamSettings.drawSignatureEnabled).toEqual(false);

  const document = await seedTeamDocumentWithMeta(team);

  const documentMeta = await prisma.documentMeta.findFirstOrThrow({
    where: {
      id: document.documentMetaId,
    },
  });

  // Confirm the settings have been applied to a newly created document.
  expect(document.visibility).toEqual(DocumentVisibility.EVERYONE);

  expect(documentMeta.typedSignatureEnabled).toEqual(true);
  expect(documentMeta.uploadSignatureEnabled).toEqual(false);
  expect(documentMeta.drawSignatureEnabled).toEqual(false);
  expect(documentMeta.language).toEqual('pl');
  expect(documentMeta.timezone).toEqual('Europe/London');
  expect(documentMeta.dateFormat).toEqual('MM/dd/yyyy');
});

test('[ORGANISATIONS]: manage branding preferences', async ({ page }) => {
  const { user, organisation, team } = await seedUser({
    isPersonalOrganisation: false,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/branding`,
  });

  // Update branding preferences.
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).click();
  await page.getByRole('textbox', { name: 'Brand Website' }).click();
  await page.getByRole('textbox', { name: 'Brand Website' }).fill('https://documenso.com');
  await page.getByRole('textbox', { name: 'Brand Details' }).click();
  await page.getByRole('textbox', { name: 'Brand Details' }).fill('BrandDetails');
  await page.getByRole('button', { name: 'Update' }).first().click();
  await expect(page.getByText('Your branding preferences have been updated').first()).toBeVisible();

  const teamSettings = await getTeamSettings({
    teamId: team.id,
  });

  // Check that the team settings have inherited these values.
  expect(teamSettings.brandingEnabled).toEqual(true);
  expect(teamSettings.brandingUrl).toEqual('https://documenso.com');
  expect(teamSettings.brandingCompanyDetails).toEqual('BrandDetails');

  // Edit the team branding settings
  await page.goto(`/t/${team.url}/settings/branding`);

  // Override team settings with different values
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).click();
  await page.getByRole('textbox', { name: 'Brand Website' }).click();
  await page.getByRole('textbox', { name: 'Brand Website' }).fill('https://example.com');
  await page.getByRole('textbox', { name: 'Brand Details' }).click();
  await page.getByRole('textbox', { name: 'Brand Details' }).fill('UpdatedBrandDetails');
  await page.getByRole('button', { name: 'Update' }).first().click();
  await expect(page.getByText('Your branding preferences have been updated').first()).toBeVisible();

  const updatedTeamSettings = await getTeamSettings({
    teamId: team.id,
  });

  // Check that the team settings have overridden the organisation values.
  expect(updatedTeamSettings.brandingEnabled).toEqual(true);
  expect(updatedTeamSettings.brandingUrl).toEqual('https://example.com');
  expect(updatedTeamSettings.brandingCompanyDetails).toEqual('UpdatedBrandDetails');

  // Test inheritance by setting team back to inherit from organisation
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Inherit from organisation' }).click();
  await page.getByRole('button', { name: 'Update' }).first().click();
  await expect(page.getByText('Your branding preferences have been updated').first()).toBeVisible();

  await page.waitForTimeout(2000);

  const inheritedTeamSettings = await getTeamSettings({
    teamId: team.id,
  });

  // Check that the team settings now inherit from organisation again.
  expect(inheritedTeamSettings.brandingEnabled).toEqual(true);
  expect(inheritedTeamSettings.brandingUrl).toEqual('https://documenso.com');
  expect(inheritedTeamSettings.brandingCompanyDetails).toEqual('BrandDetails');

  // Verify that a document can be created successfully with the branding settings
  const document = await seedTeamDocumentWithMeta(team);

  // Confirm the document was created successfully with the team's branding settings
  expect(document).toBeDefined();
  expect(document.teamId).toEqual(team.id);
});

test('[ORGANISATIONS]: manage email preferences', async ({ page }) => {
  const { user, organisation, team } = await seedUser({
    isPersonalOrganisation: false,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/email`,
  });

  // Update email preferences at organisation level.
  // Set reply to email
  await page.getByRole('textbox', { name: 'Reply to email' }).click();
  await page.getByRole('textbox', { name: 'Reply to email' }).fill('organisation@documenso.com');

  // Update email document settings by enabling/disabling some checkboxes
  await page.getByRole('checkbox', { name: 'Send recipient signed email' }).uncheck();
  await page.getByRole('checkbox', { name: 'Send document pending email' }).uncheck();
  await page.getByRole('checkbox', { name: 'Send document deleted email' }).uncheck();

  await page.getByRole('button', { name: 'Update' }).first().click();
  await expect(page.getByText('Your email preferences have been updated').first()).toBeVisible();

  const teamSettings = await getTeamSettings({
    teamId: team.id,
  });

  // Check that the team settings have inherited these values.
  expect(teamSettings.emailReplyTo).toEqual('organisation@documenso.com');
  expect(teamSettings.emailDocumentSettings).toEqual({
    recipientSigningRequest: true,
    recipientRemoved: true,
    recipientSigned: false, // unchecked
    documentPending: false, // unchecked
    documentCompleted: true,
    documentDeleted: false, // unchecked
    ownerDocumentCompleted: true,
  });

  // Edit the team email settings
  await page.goto(`/t/${team.url}/settings/email`);

  // Override team settings with different values
  await page.getByRole('textbox', { name: 'Reply to email' }).click();
  await page.getByRole('textbox', { name: 'Reply to email' }).fill('team@example.com');

  // Change email document settings inheritance to controlled
  await page.getByRole('combobox').filter({ hasText: 'Inherit from organisation' }).click();
  await page.getByRole('option', { name: 'Override organisation settings' }).click();

  // Update some email settings
  await page.getByRole('checkbox', { name: 'Send recipient signing request email' }).uncheck();
  await page
    .getByRole('checkbox', { name: 'Send document completed email', exact: true })
    .uncheck();
  await page
    .getByRole('checkbox', { name: 'Send document completed email to the owner' })
    .uncheck();

  await page.getByRole('button', { name: 'Update' }).first().click();
  await expect(page.getByText('Your email preferences have been updated').first()).toBeVisible();

  const updatedTeamSettings = await getTeamSettings({
    teamId: team.id,
  });

  // Check that the team settings have overridden the organisation values.
  expect(updatedTeamSettings.emailReplyTo).toEqual('team@example.com');
  expect(updatedTeamSettings.emailDocumentSettings).toEqual({
    recipientSigned: true,
    recipientSigningRequest: false,
    recipientRemoved: true,
    documentPending: true,
    documentCompleted: false,
    documentDeleted: true,
    ownerDocumentCompleted: false,
  });

  // Verify that a document can be created successfully with the team email settings
  const teamOverrideDocument = await seedTeamDocumentWithMeta(team);

  const teamOverrideDocumentMeta = await prisma.documentMeta.findFirstOrThrow({
    where: {
      id: teamOverrideDocument.documentMetaId,
    },
  });

  expect(teamOverrideDocumentMeta.emailReplyTo).toEqual('team@example.com');
  expect(teamOverrideDocumentMeta.emailSettings).toEqual({
    recipientSigned: true,
    recipientSigningRequest: false,
    recipientRemoved: true,
    documentPending: true,
    documentCompleted: false,
    documentDeleted: true,
    ownerDocumentCompleted: false,
  });

  // Test inheritance by setting team back to inherit from organisation
  await page.getByRole('textbox', { name: 'Reply to email' }).fill('');
  await page.getByRole('combobox').filter({ hasText: 'Override organisation settings' }).click();
  await page.getByRole('option', { name: 'Inherit from organisation' }).click();
  await page.getByRole('button', { name: 'Update' }).first().click();
  await expect(page.getByText('Your email preferences have been updated').first()).toBeVisible();

  await page.waitForTimeout(1000);

  const inheritedTeamSettings = await getTeamSettings({
    teamId: team.id,
  });

  // Check that the team settings now inherit from organisation again.
  expect(inheritedTeamSettings.emailReplyTo).toEqual('organisation@documenso.com');
  expect(inheritedTeamSettings.emailDocumentSettings).toEqual({
    recipientSigningRequest: true,
    recipientRemoved: true,
    recipientSigned: false,
    documentPending: false,
    documentCompleted: true,
    documentDeleted: false,
    ownerDocumentCompleted: true,
  });

  // Verify that a document can be created successfully with the email settings
  const document = await seedTeamDocumentWithMeta(team);

  const documentMeta = await prisma.documentMeta.findFirstOrThrow({
    where: {
      id: document.documentMetaId,
    },
  });

  expect(documentMeta.emailReplyTo).toEqual('organisation@documenso.com');
  expect(documentMeta.emailSettings).toEqual({
    recipientSigningRequest: true,
    recipientRemoved: true,
    recipientSigned: false,
    documentPending: false,
    documentCompleted: true,
    documentDeleted: false,
    ownerDocumentCompleted: true,
  });
});
