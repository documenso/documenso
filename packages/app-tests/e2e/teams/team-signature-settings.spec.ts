import { expect, test } from '@playwright/test';

import { prisma } from '@documenso/prisma';
import {
  seedTeamDocumentWithMeta,
  seedTeamDocuments,
  seedTeamTemplateWithMeta,
} from '@documenso/prisma/seed/documents';

import { apiSignin } from '../fixtures/authentication';

test('[TEAMS]: check that default team signature settings are all enabled', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: team.owner.email,
    password: 'password',
    redirectPath: `/t/${team.url}/settings/preferences`,
  });

  // Verify that the default created team settings has all signatures enabled
  await expect(page.getByRole('combobox').filter({ hasText: 'Type' })).toBeVisible();
  await expect(page.getByRole('combobox').filter({ hasText: 'Upload' })).toBeVisible();
  await expect(page.getByRole('combobox').filter({ hasText: 'Draw' })).toBeVisible();

  const document = await seedTeamDocumentWithMeta(team);

  // Create a document and check the settings
  await page.goto(`/t/${team.url}/documents/${document.id}/edit`);

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
  const { team } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: team.owner.email,
    password: 'password',
    redirectPath: `/t/${team.url}/settings/preferences`,
  });

  const allTabs = ['Type', 'Upload', 'Draw'];
  const tabTest = [['Type', 'Upload', 'Draw'], ['Type', 'Upload'], ['Type']];

  for (const tabs of tabTest) {
    await page.goto(`/t/${team.url}/settings/preferences`);

    // Update combobox to have the correct tabs
    await page.getByTestId('signature-types-combobox').click();

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
    const toast = page.locator('li[role="status"][data-state="open"]').first();
    await expect(toast).toBeVisible();
    await expect(toast.getByText('Document preferences updated', { exact: true })).toBeVisible();

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
  const { team } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: team.owner.email,
    password: 'password',
    redirectPath: `/t/${team.url}/settings/preferences`,
  });

  const allTabs = ['Type', 'Upload', 'Draw'];
  const tabTest = [['Type', 'Upload', 'Draw'], ['Type', 'Upload'], ['Type']];

  for (const tabs of tabTest) {
    await page.goto(`/t/${team.url}/settings/preferences`);

    // Update combobox to have the correct tabs
    await page.getByTestId('signature-types-combobox').click();

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
    const toast = page.locator('li[role="status"][data-state="open"]').first();
    await expect(toast).toBeVisible();
    await expect(toast.getByText('Document preferences updated', { exact: true })).toBeVisible();

    const template = await seedTeamTemplateWithMeta(team);

    await page.goto(`/t/${team.url}/templates/${template.id}`);
    await page.getByRole('button', { name: 'Use' }).click();

    // Check the send document checkbox to true
    await page.getByLabel('Send document').click();
    await page.getByRole('button', { name: 'Create and send' }).click();
    await page.waitForTimeout(1000);

    const document = await prisma.document.findFirst({
      where: {
        templateId: template.id,
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
