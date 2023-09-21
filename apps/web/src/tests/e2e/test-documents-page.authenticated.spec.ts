import { type Page, expect, test } from '@playwright/test';

/* 
  There was a bit of code duplication because each test starts from the first step - which is uploading a document.
  Then each subsequent test adds a new step. So, for each test we repeat the steps from the previous tests.

  I extracted the most common steps into functions and then I call them in each test.
  Also, the document upload is used in all tests, so I added it to the beforeEach hook.
*/
const addSigner = async (page: Page) => {
  await page.getByLabel('Email*').fill('example@email.com');
  await page.getByLabel('Name').fill('User');
  await page.getByRole('button', { name: 'Continue' }).click();
};

const addSignatureField = async (page: Page) => {
  await page.getByRole('button', { name: 'User Signature' }).dragTo(page.locator('canvas'));
  await page.getByRole('button', { name: 'Continue' }).click();
};

test.describe('Document upload test', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Documenso - The Open Source DocuSign Alternative');

    await page
      .getByText('Add a documentDrag & drop your document here.')
      .locator('input[type=file]')
      .setInputFiles('./src/tests/e2e/documenso.pdf');
  });

  test('user can see /documents page', async ({ page }: { page: Page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Documenso - The Open Source DocuSign Alternative');
  });

  test('user can add 1 signer', async ({ page }: { page: Page }) => {
    await addSigner(page);
  });

  test('user can add signature field', async ({ page }: { page: Page }) => {
    await addSigner(page);

    await addSignatureField(page);
  });

  test('user can add subject and message', async ({ page }: { page: Page }) => {
    await addSigner(page);

    await addSignatureField(page);

    await page
      .locator('div')
      .filter({ hasText: /^Subject \(Optional\)$/ })
      .locator('input')
      .fill('New document');
    await page
      .locator('div')
      .filter({ hasText: /^Message \(Optional\)$/ })
      .locator('textarea')
      .fill('Please sign it in and send it back to me.');
    await page.getByRole('button', { name: 'Send' }).click();
  });
});
