import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { getFieldsForDocument } from '@documenso/lib/server-only/field/get-fields-for-document';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

const setupDocumentAndNavigateToFieldsStep = async (page: Page) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient 1');

  await page.getByRole('button', { name: 'Add signer' }).click();

  await page.getByPlaceholder('Email').nth(1).fill('recipient2@documenso.com');
  await page.getByPlaceholder('Name').nth(1).fill('Recipient 2');

  await page.getByRole('button', { name: 'Continue' }).click();

  return { user, document };
};

const triggerAutosave = async (page: Page) => {
  await page.locator('#document-flow-form-container').click();
  await page.waitForTimeout(3000);
};

test.describe('AutoSave Fields Step', () => {
  test('should autosave the fields without advanced settings', async ({ page }) => {
    const { user, document } = await setupDocumentAndNavigateToFieldsStep(page);

    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 100,
      },
    });

    await page.getByRole('button', { name: 'Text' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 200,
      },
    });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await triggerAutosave(page);

    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Recipient 2 (recipient2@documenso.com)' }).click();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 500,
      },
    });

    await triggerAutosave(page);

    const fieldsFromDB = await getFieldsForDocument({
      documentId: document.id,
      userId: user.id,
    });

    expect(fieldsFromDB.length).toBe(3);
    expect(fieldsFromDB[0].type).toBe('SIGNATURE');
    expect(fieldsFromDB[1].type).toBe('TEXT');
    expect(fieldsFromDB[2].type).toBe('SIGNATURE');
  });

  test('should autosave the field deletion', async ({ page }) => {
    const { user, document } = await setupDocumentAndNavigateToFieldsStep(page);

    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 100,
      },
    });

    await page.getByRole('button', { name: 'Text' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 200,
      },
    });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await triggerAutosave(page);

    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Recipient 2 (recipient2@documenso.com)' }).click();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 500,
      },
    });

    await triggerAutosave(page);

    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Recipient 1 (recipient1@documenso.com)' }).click();

    await page.getByText('Text').nth(1).click();
    await page.getByRole('button', { name: 'Remove' }).click();

    await triggerAutosave(page);

    const fieldsFromDB = await getFieldsForDocument({
      documentId: document.id,
      userId: user.id,
    });

    expect(fieldsFromDB.length).toBe(2);
    expect(fieldsFromDB[0].type).toBe('SIGNATURE');
    expect(fieldsFromDB[1].type).toBe('SIGNATURE');
  });

  test('should autosave the field duplication', async ({ page }) => {
    const { user, document } = await setupDocumentAndNavigateToFieldsStep(page);

    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 100,
      },
    });

    await page.getByRole('button', { name: 'Text' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 200,
      },
    });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await triggerAutosave(page);

    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Recipient 2 (recipient2@documenso.com)' }).click();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 500,
      },
    });

    await triggerAutosave(page);

    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Recipient 1 (recipient1@documenso.com)' }).click();

    await page.getByText('Signature').nth(1).click();
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();

    await triggerAutosave(page);

    const fieldsFromDB = await getFieldsForDocument({
      documentId: document.id,
      userId: user.id,
    });

    expect(fieldsFromDB.length).toBe(4);
    expect(fieldsFromDB[0].type).toBe('SIGNATURE');
    expect(fieldsFromDB[1].type).toBe('TEXT');
    expect(fieldsFromDB[2].type).toBe('SIGNATURE');
    expect(fieldsFromDB[3].type).toBe('SIGNATURE');
  });

  // TODO: Add test for autosave the fields with advanced settings
  /* test('should autosave the fields with advanced settings', async ({ page }) => {
    const { user, document } = await setupDocumentAndNavigateToFieldsStep(page);

    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 100,
      },
    });

    await page.getByRole('button', { name: 'Text' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 200,
      },
    });

    await page.getByRole('textbox', { name: 'Field label' }).fill('Test Field');
    await page.getByRole('textbox', { name: 'Field placeholder' }).fill('Test Placeholder');
    await page.getByRole('textbox', { name: 'Add text to the field' }).fill('Test Text');
  }); */
});
