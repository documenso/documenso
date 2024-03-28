import { expect, test } from '@playwright/test';
import path from 'node:path';

import { getRecipientByEmail } from '@documenso/lib/server-only/recipient/get-recipient-by-email';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from './fixtures/authentication';

const getDocumentByToken = async (token: string) => {
  return await prisma.document.findFirstOrThrow({
    where: {
      Recipient: {
        some: {
          token,
        },
      },
    },
  });
};

test(`[PR-718]: should be able to create a document`, async ({ page }) => {
  await page.goto('/signin');

  const documentTitle = `example-${Date.now()}.pdf`;

  const user = await seedUser();

  await apiSignin({
    page,
    email: user.email,
  });

  // Upload document
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('input[type=file]').evaluate((e) => {
      if (e instanceof HTMLInputElement) {
        e.click();
      }
    }),
  ]);

  await fileChooser.setFiles(path.join(__dirname, '../../../assets/example.pdf'));

  // Wait to be redirected to the edit page
  await page.waitForURL(/\/documents\/\d+/);

  // Set general settings
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  await page.getByLabel('Title').fill(documentTitle);

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add signers
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  await page.getByLabel('Email*').fill('user1@example.com');
  await page.getByLabel('Name').fill('User 1');

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add fields
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'User 1 Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Email Email' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 200,
    },
  });

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add subject and send
  await expect(page.getByRole('heading', { name: 'Add Subject' })).toBeVisible();
  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL('/documents');

  // Assert document was created
  await expect(page.getByRole('link', { name: documentTitle })).toBeVisible();
});

test('should be able to create a document with multiple recipients', async ({ page }) => {
  await page.goto('/signin');

  const documentTitle = `example-${Date.now()}.pdf`;

  const user = await seedUser();

  await apiSignin({
    page,
    email: user.email,
  });

  // Upload document
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('input[type=file]').evaluate((e) => {
      if (e instanceof HTMLInputElement) {
        e.click();
      }
    }),
  ]);

  await fileChooser.setFiles(path.join(__dirname, '../../../assets/example.pdf'));

  // Wait to be redirected to the edit page
  await page.waitForURL(/\/documents\/\d+/);

  // Set title
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  await page.getByLabel('Title').fill(documentTitle);

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add signers
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  // Add 2 signers.
  await page.getByPlaceholder('Email').fill('user1@example.com');
  await page.getByPlaceholder('Name').fill('User 1');
  await page.getByRole('button', { name: 'Add Signer' }).click();
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('user2@example.com');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('User 2');

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add fields
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'User 1 Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Email Email' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 200,
    },
  });

  await page.getByText('User 1 (user1@example.com)').click();
  await page.getByText('User 2 (user2@example.com)').click();

  await page.getByRole('button', { name: 'User 2 Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 500,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Email Email' }).click();
  await page.locator('canvas').click({
    position: {
      x: 500,
      y: 200,
    },
  });

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add subject and send
  await expect(page.getByRole('heading', { name: 'Add Subject' })).toBeVisible();
  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL('/documents');

  // Assert document was created
  await expect(page.getByRole('link', { name: documentTitle })).toBeVisible();
});

test('should be able to create, send and sign a document', async ({ page }) => {
  await page.goto('/signin');

  const documentTitle = `example-${Date.now()}.pdf`;

  const user = await seedUser();

  await apiSignin({
    page,
    email: user.email,
  });

  // Upload document
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('input[type=file]').evaluate((e) => {
      if (e instanceof HTMLInputElement) {
        e.click();
      }
    }),
  ]);

  await fileChooser.setFiles(path.join(__dirname, '../../../assets/example.pdf'));

  // Wait to be redirected to the edit page
  await page.waitForURL(/\/documents\/\d+/);

  // Set title
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  await page.getByLabel('Title').fill(documentTitle);

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add signers
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  await page.getByPlaceholder('Email').fill('user1@example.com');
  await page.getByPlaceholder('Name').fill('User 1');

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add fields
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Add subject and send
  await expect(page.getByRole('heading', { name: 'Add Subject' })).toBeVisible();
  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL('/documents');

  // Assert document was created
  await expect(page.getByRole('link', { name: documentTitle })).toBeVisible();
  await page.getByRole('link', { name: documentTitle }).click();
  await page.waitForURL(/\/documents\/\d+/);

  const url = page.url().split('/');
  const documentId = url[url.length - 1];

  const { token } = await getRecipientByEmail({
    email: 'user1@example.com',
    documentId: Number(documentId),
  });

  await page.goto(`/sign/${token}`);
  await page.waitForURL(`/sign/${token}`);

  // Check if document has been viewed
  const { status } = await getDocumentByToken(token);
  expect(status).toBe(DocumentStatus.PENDING);

  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('dialog').getByText('Sign Document')).toBeVisible();
  await page.getByRole('button', { name: 'Sign' }).click();

  await page.waitForURL(`/sign/${token}/complete`);
  await expect(page.getByText('You have signed')).toBeVisible();

  // Check if document has been signed
  const { status: completedStatus } = await getDocumentByToken(token);
  expect(completedStatus).toBe(DocumentStatus.COMPLETED);
});

test('should be able to create, send with redirect url, sign a document and redirect to redirect url', async ({
  page,
}) => {
  await page.goto('/signin');

  const documentTitle = `example-${Date.now()}.pdf`;

  const user = await seedUser();

  await apiSignin({
    page,
    email: user.email,
  });

  // Upload document
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('input[type=file]').evaluate((e) => {
      if (e instanceof HTMLInputElement) {
        e.click();
      }
    }),
  ]);

  await fileChooser.setFiles(path.join(__dirname, '../../../assets/example.pdf'));

  // Wait to be redirected to the edit page
  await page.waitForURL(/\/documents\/\d+/);

  // Set title & advanced redirect
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();
  await page.getByLabel('Title').fill(documentTitle);
  await page.getByRole('button', { name: 'Advanced Options' }).click();
  await page.getByLabel('Redirect URL').fill('https://documenso.com');

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add signers
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  await page.getByPlaceholder('Email').fill('user1@example.com');
  await page.getByPlaceholder('Name').fill('User 1');

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add fields
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL('/documents');

  // Assert document was created
  await expect(page.getByRole('link', { name: documentTitle })).toBeVisible();
  await page.getByRole('link', { name: documentTitle }).click();
  await page.waitForURL(/\/documents\/\d+/);

  const url = page.url().split('/');
  const documentId = url[url.length - 1];

  const { token } = await getRecipientByEmail({
    email: 'user1@example.com',
    documentId: Number(documentId),
  });

  await page.goto(`/sign/${token}`);
  await page.waitForURL(`/sign/${token}`);

  // Check if document has been viewed
  const { status } = await getDocumentByToken(token);
  expect(status).toBe(DocumentStatus.PENDING);

  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('dialog').getByText('Sign Document')).toBeVisible();
  await page.getByRole('button', { name: 'Sign' }).click();

  await page.waitForURL('https://documenso.com');

  // Check if document has been signed
  const { status: completedStatus } = await getDocumentByToken(token);
  expect(completedStatus).toBe(DocumentStatus.COMPLETED);
});
