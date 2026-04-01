import { expect, test } from '@playwright/test';

import {
  mapSecondaryIdToDocumentId,
  mapSecondaryIdToTemplateId,
} from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import {
  seedTeamDocumentWithMeta,
  seedTeamTemplateWithMeta,
} from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test('[TEAMS]: check that default team signature settings are all enabled', async ({ page }) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/document`,
  });

  const document = await seedTeamDocumentWithMeta(team);

  // Create a document and check the settings
  await page.goto(
    `/t/${team.url}/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/edit`,
  );

  // Verify that the settings match
  await page.getByRole('button', { name: 'Advanced Options' }).click();
  await expect(page.getByRole('combobox').filter({ hasText: 'Type' })).toBeVisible();
  await expect(page.getByRole('combobox').filter({ hasText: 'Upload' })).toBeVisible();
  await expect(page.getByRole('combobox').filter({ hasText: 'Draw' })).toBeVisible();

  // Go to document and check that the signatured tabs are correct.
  await page.goto(`/sign/${document.recipients[0].token}`);
  await page.getByTestId('signature-pad-dialog-button').click();

  // Check the tab values
  await expect(page.getByRole('tab', { name: 'Type' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Upload' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Draw' })).toBeVisible();
});

test('[TEAMS]: check signature modes can be disabled', async ({ page }) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/document`,
  });

  const allTabs = ['Type', 'Upload', 'Draw'];
  const tabTest = [['Type', 'Upload', 'Draw'], ['Type', 'Upload'], ['Type']];

  for (const tabs of tabTest) {
    await page.goto(`/t/${team.url}/settings/document`);

    // Update combobox to have the correct tabs
    await page.getByTestId('signature-types-trigger').click();

    await expect(page.getByRole('option', { name: 'Type' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Upload' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Draw' })).toBeVisible();

    // Clear all selected items.
    for (const tab of allTabs) {
      const item = page.getByRole('option', { name: tab });

      const isSelected = (await item.innerHTML()).includes('opacity-100');

      if (isSelected) {
        await item.click();
      }
    }

    // Selected wanted items.
    for (const tab of tabs) {
      const item = page.getByRole('option', { name: tab });
      await item.click();
    }

    await page.getByRole('button', { name: 'Update' }).first().click();

    // Wait for the update to complete
    await expect(page.getByText('Document preferences updated', { exact: true })).toBeVisible();

    const document = await seedTeamDocumentWithMeta(team);

    // Go to document and check that the signature tabs are correct.
    await page.goto(`/sign/${document.recipients[0].token}`);
    await page.getByTestId('signature-pad-dialog-button').click();

    // Wait for signature dialog to fully load
    await page.waitForSelector('[role="dialog"]');

    // Check the tab values
    for (const tab of allTabs) {
      if (tabs.includes(tab)) {
        await expect(page.getByRole('tab', { name: tab })).toBeVisible();
      } else {
        // await expect(page.getByRole('tab', { name: tab })).not.toBeVisible();
        await expect(page.getByRole('tab', { name: tab })).toHaveCount(0);
      }
    }
  }
});

test('[TEAMS]: check signature modes work for templates', async ({ page }) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/document`,
  });

  const allTabs = ['Type', 'Upload', 'Draw'];
  const tabTest = [['Type', 'Upload', 'Draw'], ['Type', 'Upload'], ['Type']];

  for (const tabs of tabTest) {
    await page.goto(`/t/${team.url}/settings/document`);

    // Update combobox to have the correct tabs
    await page.getByTestId('signature-types-trigger').click();

    await expect(page.getByRole('option', { name: 'Type' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Upload' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Draw' })).toBeVisible();

    // Clear all selected items.
    for (const tab of allTabs) {
      const item = page.getByRole('option', { name: tab });

      const isSelected = (await item.innerHTML()).includes('opacity-100');

      if (isSelected) {
        await item.click();
      }
    }

    // Selected wanted items.
    for (const tab of tabs) {
      const item = page.getByRole('option', { name: tab });
      await item.click();
    }

    await page.getByRole('button', { name: 'Update' }).first().click();

    // Wait for finish
    await expect(page.getByText('Document preferences updated', { exact: true })).toBeVisible();

    const template = await seedTeamTemplateWithMeta(team);

    await page.goto(`/t/${team.url}/templates/${mapSecondaryIdToTemplateId(template.secondaryId)}`);
    await page.getByRole('button', { name: 'Use' }).click();

    // Check the send document checkbox to true
    await page.getByLabel('Send document').click();
    await page.getByRole('button', { name: 'Create and send' }).click();
    await page.waitForTimeout(1000);

    const document = await prisma.envelope.findFirst({
      where: {
        // Created from template
        templateId: mapSecondaryIdToTemplateId(template.secondaryId),
      },
      include: {
        documentMeta: true,
      },
    });

    // Test kinda flaky, debug here.
    // console.log({
    //   tabs,
    //   typedSignatureEnabled: document?.documentMeta?.typedSignatureEnabled,
    //   uploadSignatureEnabled: document?.documentMeta?.uploadSignatureEnabled,
    //   drawSignatureEnabled: document?.documentMeta?.drawSignatureEnabled,
    // });

    expect(document?.documentMeta?.typedSignatureEnabled).toEqual(tabs.includes('Type'));
    expect(document?.documentMeta?.uploadSignatureEnabled).toEqual(tabs.includes('Upload'));
    expect(document?.documentMeta?.drawSignatureEnabled).toEqual(tabs.includes('Draw'));
  }
});
