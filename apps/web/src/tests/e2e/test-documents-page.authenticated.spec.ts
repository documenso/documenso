import path from 'path';

import { expect, test } from '../test-fixtures/documents-page/documents-page';

const signer_name = process.env.E2E_TEST_SIGNER_NAME;
const signer_email = process.env.E2E_TEST_SIGNER_EMAIL;
const signing_subject = process.env.E2E_TEST_SIGNING_SUBJECT;
const signing_message = process.env.E2E_TEST_SIGNING_MESSAGE;

if (!signer_name || !signer_email || !signing_subject || !signing_message) {
  throw new Error('Required environment variables for tests are not defined');
}

test.describe('Document upload test', () => {
  test.beforeEach(async ({ documentsPage }) => {
    await documentsPage.uploadDocument(path.join(__dirname, './documenso.pdf'));
  });

  test('user can see /documents page', async ({ page, documentsPage }) => {
    await documentsPage.goToDocumentsPage();
    await expect(page).toHaveTitle('Documenso - The Open Source DocuSign Alternative');
  });

  test('user can upload a document succesfully', async ({ page }) => {
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('user can add 1 signer', async ({ documentsPage }) => {
    await documentsPage.addSigner(signer_email, signer_name);
  });

  test('user can add signature field', async ({ documentsPage }) => {
    await documentsPage.addSigner(signer_email, signer_name);
    await documentsPage.addSignatureField(signer_name);
  });

  test('user can add subject and message', async ({ documentsPage }) => {
    await documentsPage.addSigner(signer_email, signer_name);
    await documentsPage.addSignatureField(signer_name);
    await documentsPage.addSubjectAndMessage(signing_subject, signing_message);
  });
});
