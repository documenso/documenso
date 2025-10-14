import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { EnvelopeType } from '@prisma/client';

import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { getRecipientsForDocument } from '@documenso/lib/server-only/recipient/get-recipients-for-document';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

const setupDocumentAndNavigateToSignersStep = async (page: Page) => {
  const { user, team } = await seedUser();
  const document = await seedBlankDocument(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();

  return { user, team, document };
};

const triggerAutosave = async (page: Page) => {
  await page.locator('body').click({ position: { x: 0, y: 0 } });
  await page.locator('#document-flow-form-container').blur();

  await page.waitForTimeout(5000);
};

const addSignerAndSave = async (page: Page) => {
  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient 1');

  await triggerAutosave(page);
};

test.describe('AutoSave Signers Step', () => {
  test('should autosave the signers addition', async ({ page }) => {
    const { user, document, team } = await setupDocumentAndNavigateToSignersStep(page);

    await addSignerAndSave(page);

    await expect(async () => {
      const retrievedRecipients = await getRecipientsForDocument({
        documentId: mapSecondaryIdToDocumentId(document.secondaryId),
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedRecipients.length).toBe(1);
      expect(retrievedRecipients[0].email).toBe('recipient1@documenso.com');
      expect(retrievedRecipients[0].name).toBe('Recipient 1');
    }).toPass();
  });

  test('should autosave the signer deletion', async ({ page }) => {
    const { user, document, team } = await setupDocumentAndNavigateToSignersStep(page);

    await addSignerAndSave(page);

    await page.getByRole('button', { name: 'Add myself' }).click();
    await triggerAutosave(page);

    await page.getByTestId('remove-signer-button').first().click();
    await triggerAutosave(page);

    await expect(async () => {
      const retrievedRecipients = await getRecipientsForDocument({
        documentId: mapSecondaryIdToDocumentId(document.secondaryId),
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedRecipients.length).toBe(1);
      expect(retrievedRecipients[0].email).toBe(user.email);
      expect(retrievedRecipients[0].name).toBe(user.name);
    }).toPass();
  });

  test('should autosave the signer update', async ({ page }) => {
    const { user, document, team } = await setupDocumentAndNavigateToSignersStep(page);

    await addSignerAndSave(page);

    await page.getByPlaceholder('Name').fill('Documenso Manager');
    await page.getByPlaceholder('Email').fill('manager@documenso.com');

    await triggerAutosave(page);

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Receives copy' }).click();

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedRecipients = await getRecipientsForDocument({
        documentId: mapSecondaryIdToDocumentId(document.secondaryId),
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedRecipients.length).toBe(1);
      expect(retrievedRecipients[0].email).toBe('manager@documenso.com');
      expect(retrievedRecipients[0].name).toBe('Documenso Manager');
      expect(retrievedRecipients[0].role).toBe('CC');
    }).toPass();
  });

  test('should autosave the signing order change', async ({ page }) => {
    const { user, document, team } = await setupDocumentAndNavigateToSignersStep(page);

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

    await expect(async () => {
      const retrievedDocumentData = await getEnvelopeById({
        id: {
          type: 'envelopeId',
          id: document.id,
        },
        type: EnvelopeType.DOCUMENT,
        userId: user.id,
        teamId: team.id,
      });

      const retrievedRecipients = await getRecipientsForDocument({
        documentId: mapSecondaryIdToDocumentId(document.secondaryId),
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedDocumentData.documentMeta?.signingOrder).toBe('SEQUENTIAL');
      expect(retrievedDocumentData.documentMeta?.allowDictateNextSigner).toBe(true);
      expect(retrievedRecipients.length).toBe(3);

      const firstRecipient = retrievedRecipients.find(
        (r) => r.email === 'recipient1@documenso.com',
      );
      const secondRecipient = retrievedRecipients.find(
        (r) => r.email === 'recipient2@documenso.com',
      );
      const thirdRecipient = retrievedRecipients.find(
        (r) => r.email === 'recipient3@documenso.com',
      );

      expect(firstRecipient?.signingOrder).toBe(2);
      expect(secondRecipient?.signingOrder).toBe(3);
      expect(thirdRecipient?.signingOrder).toBe(1);
    }).toPass();
  });
});
