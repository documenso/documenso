import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getRecipientsForDocument } from '@documenso/lib/server-only/recipient/get-recipients-for-document';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

const setupDocumentAndNavigateToSignersStep = async (page: Page) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();

  return { user, document };
};

const triggerAutosave = async (page: Page) => {
  await page.locator('#document-flow-form-container').click();
  await page.waitForTimeout(3000);
};

const addSignerAndSave = async (page: Page) => {
  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient 1');

  await triggerAutosave(page);
};

test.describe('AutoSave Signers Step', () => {
  test('should autosave the signers addition', async ({ page }) => {
    const { user, document } = await setupDocumentAndNavigateToSignersStep(page);

    await addSignerAndSave(page);

    const recipientsFromDB = await getRecipientsForDocument({
      documentId: document.id,
      userId: user.id,
    });

    expect(recipientsFromDB.length).toBe(1);
    expect(recipientsFromDB[0].email).toBe('recipient1@documenso.com');
    expect(recipientsFromDB[0].name).toBe('Recipient 1');
  });

  test('should autosave the signer deletion', async ({ page }) => {
    const { user, document } = await setupDocumentAndNavigateToSignersStep(page);

    await addSignerAndSave(page);

    await page.getByRole('button', { name: 'Add myself' }).click();
    await triggerAutosave(page);

    await page.getByTestId('remove-signer-button').first().click();
    await triggerAutosave(page);

    const recipientsFromDB = await getRecipientsForDocument({
      documentId: document.id,
      userId: user.id,
    });

    expect(recipientsFromDB.length).toBe(1);
    expect(recipientsFromDB[0].email).toBe(user.email);
    expect(recipientsFromDB[0].name).toBe(user.name);
  });

  test('should autosave the signer update', async ({ page }) => {
    const { user, document } = await setupDocumentAndNavigateToSignersStep(page);

    await addSignerAndSave(page);

    await page.getByPlaceholder('Name').fill('Documenso Manager');
    await page.getByPlaceholder('Email').fill('manager@documenso.com');

    await triggerAutosave(page);

    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Receives copy' }).click();

    await triggerAutosave(page);

    const recipientsFromDB = await getRecipientsForDocument({
      documentId: document.id,
      userId: user.id,
    });

    expect(recipientsFromDB.length).toBe(1);
    expect(recipientsFromDB[0].email).toBe('manager@documenso.com');
    expect(recipientsFromDB[0].name).toBe('Documenso Manager');
    expect(recipientsFromDB[0].role).toBe('CC');
  });

  test('should autosave the signining order change', async ({ page }) => {
    const { user, document } = await setupDocumentAndNavigateToSignersStep(page);

    await addSignerAndSave(page);

    await page.getByRole('button', { name: 'Add signer' }).click();

    await page.getByTestId('signer-email-input').nth(1).fill('recipient2@documenso.com');
    await page.getByLabel('Name').nth(1).fill('Recipient 2');

    await page.getByRole('button', { name: 'Add Signer' }).click();

    await page.getByTestId('signer-email-input').nth(2).fill('recipient3@documenso.com');
    await page.getByLabel('Name').nth(2).fill('Recipient 3');

    await triggerAutosave(page);

    await page.getByLabel('Enable signing order').check();
    await page.getByLabel('Allow signers to dictate next signer').check();
    await triggerAutosave(page);

    await page.getByTestId('signing-order-input').nth(0).fill('3');
    await page.getByTestId('signing-order-input').nth(0).blur();
    await triggerAutosave(page);

    await page.getByTestId('signing-order-input').nth(1).fill('1');
    await page.getByTestId('signing-order-input').nth(1).blur();
    await triggerAutosave(page);

    await page.getByTestId('signing-order-input').nth(2).fill('2');
    await page.getByTestId('signing-order-input').nth(2).blur();
    await triggerAutosave(page);

    const documentDataFromDB = await getDocumentById({
      documentId: document.id,
      userId: user.id,
    });

    const recipientsFromDB = await getRecipientsForDocument({
      documentId: document.id,
      userId: user.id,
    });

    expect(documentDataFromDB.documentMeta?.signingOrder).toBe('SEQUENTIAL');
    expect(documentDataFromDB.documentMeta?.allowDictateNextSigner).toBe(true);
    expect(recipientsFromDB.length).toBe(3);
    expect(recipientsFromDB[0].signingOrder).toBe(2);
    expect(recipientsFromDB[1].signingOrder).toBe(3);
    expect(recipientsFromDB[2].signingOrder).toBe(1);
  });
});
