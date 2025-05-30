import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

const setupDocument = async (page: Page) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  return { user, document };
};

const triggerAutosave = async (page: Page) => {
  await page.locator('#document-flow-form-container').click();
  await page.waitForTimeout(3000);
};

test.describe('AutoSave Settings Step', () => {
  test('should autosave the title change', async ({ page }) => {
    const { user, document } = await setupDocument(page);

    const newDocumentTitle = 'New Document Title';

    await page.getByRole('textbox', { name: 'Title *' }).fill(newDocumentTitle);

    await triggerAutosave(page);

    const documentDataFromDB = await getDocumentById({
      documentId: document.id,
      userId: user.id,
    });

    await expect(page.getByRole('textbox', { name: 'Title *' })).toHaveValue(
      documentDataFromDB.title,
    );
  });

  test('should autosave the language change', async ({ page }) => {
    const { user, document } = await setupDocument(page);

    const newDocumentLanguage = 'French';
    const expectedLanguageCode = 'fr';

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: newDocumentLanguage }).click();

    await triggerAutosave(page);

    const documentDataFromDB = await getDocumentById({
      documentId: document.id,
      userId: user.id,
    });

    expect(documentDataFromDB.documentMeta?.language).toBe(expectedLanguageCode);
  });

  test('should autosave the document access change', async ({ page }) => {
    const { user, document } = await setupDocument(page);

    const access = 'Require account';
    const accessValue = 'ACCOUNT';

    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: access }).click();

    await triggerAutosave(page);

    const documentDataFromDB = await getDocumentById({
      documentId: document.id,
      userId: user.id,
    });

    expect(documentDataFromDB.authOptions?.globalAccessAuth).toBe(accessValue);
  });

  test('should autosave the external ID change', async ({ page }) => {
    const { user, document } = await setupDocument(page);

    const newExternalId = '1234567890';

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('textbox', { name: 'External ID' }).fill(newExternalId);

    await triggerAutosave(page);

    const documentDataFromDB = await getDocumentById({
      documentId: document.id,
      userId: user.id,
    });

    expect(documentDataFromDB.externalId).toBe(newExternalId);
  });

  test('should autosave the allowed signature types change', async ({ page }) => {
    const { user, document } = await setupDocument(page);

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('combobox').nth(2).click();
    await page.getByRole('option', { name: 'Draw' }).click();
    await page.getByRole('option', { name: 'Type' }).click();

    await triggerAutosave(page);

    const documentDataFromDB = await getDocumentById({
      documentId: document.id,
      userId: user.id,
    });

    expect(documentDataFromDB.documentMeta?.drawSignatureEnabled).toBe(false);
    expect(documentDataFromDB.documentMeta?.typedSignatureEnabled).toBe(false);
    expect(documentDataFromDB.documentMeta?.uploadSignatureEnabled).toBe(true);
  });

  test('should autosave the date format change', async ({ page }) => {
    const { user, document } = await setupDocument(page);

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('combobox').nth(3).click();
    await page.getByRole('option', { name: 'ISO 8601' }).click();

    await triggerAutosave(page);

    const documentDataFromDB = await getDocumentById({
      documentId: document.id,
      userId: user.id,
    });

    expect(documentDataFromDB.documentMeta?.dateFormat).toBe("yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
  });

  test('should autosave the timezone change', async ({ page }) => {
    const { user, document } = await setupDocument(page);

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('combobox').nth(4).click();
    await page.getByRole('option', { name: 'Europe/London' }).click();

    await triggerAutosave(page);

    const documentDataFromDB = await getDocumentById({
      documentId: document.id,
      userId: user.id,
    });

    expect(documentDataFromDB.documentMeta?.timezone).toBe('Europe/London');
  });

  test('should autosave the redirect URL change', async ({ page }) => {
    const { user, document } = await setupDocument(page);

    const newRedirectUrl = 'https://documenso.com/test/';

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('textbox', { name: 'Redirect URL' }).fill(newRedirectUrl);

    await triggerAutosave(page);

    const documentDataFromDB = await getDocumentById({
      documentId: document.id,
      userId: user.id,
    });

    expect(documentDataFromDB.documentMeta?.redirectUrl).toBe(newRedirectUrl);
  });

  test('should autosave multiple field changes together', async ({ page }) => {
    const { user, document } = await setupDocument(page);

    const newTitle = 'Updated Document Title';
    await page.getByRole('textbox', { name: 'Title *' }).fill(newTitle);

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'German' }).click();

    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'Require account' }).click();

    await page.getByRole('button', { name: 'Advanced Options' }).click();
    const newExternalId = 'MULTI-TEST-123';
    await page.getByRole('textbox', { name: 'External ID' }).fill(newExternalId);

    await page.getByRole('combobox').nth(4).click();
    await page.getByRole('option', { name: 'Europe/Berlin' }).click();

    await triggerAutosave(page);

    const documentDataFromDB = await getDocumentById({
      documentId: document.id,
      userId: user.id,
    });

    expect(documentDataFromDB.title).toBe(newTitle);
    expect(documentDataFromDB.documentMeta?.language).toBe('de');
    expect(documentDataFromDB.authOptions?.globalAccessAuth).toBe('ACCOUNT');
    expect(documentDataFromDB.externalId).toBe(newExternalId);
    expect(documentDataFromDB.documentMeta?.timezone).toBe('Europe/Berlin');
  });
});
