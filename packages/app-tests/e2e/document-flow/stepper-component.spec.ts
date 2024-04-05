import { expect, test } from '@playwright/test';
import path from 'node:path';

import { getRecipientByEmail } from '@documenso/lib/server-only/recipient/get-recipient-by-email';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser, unseedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

// Can't use the function in server-only/document due to it indirectly using
// require imports.
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

test('[DOCUMENT_FLOW]: should be able to upload a PDF document', async ({ page }) => {
  const user = await seedUser();

  await apiSignin({
    page,
    email: user.email,
  });

  // Upload document.
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('input[type=file]').evaluate((e) => {
      if (e instanceof HTMLInputElement) {
        e.click();
      }
    }),
  ]);

  await fileChooser.setFiles(path.join(__dirname, '../../../../assets/example.pdf'));

  // Wait to be redirected to the edit page.
  await page.waitForURL(/\/documents\/\d+/);
});

test('[DOCUMENT_FLOW]: should be able to create a document', async ({ page }) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  const documentTitle = `example-${Date.now()}.pdf`;

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

  await unseedUser(user.id);
});

test('[DOCUMENT_FLOW]: should be able to create a document with multiple recipients', async ({
  page,
}) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  const documentTitle = `example-${Date.now()}.pdf`;

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

  await unseedUser(user.id);
});

test('[DOCUMENT_FLOW]: should be able to create a document with multiple recipients with different roles', async ({
  page,
}) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  const documentTitle = `example-${Date.now()}.pdf`;

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
  await page.locator('button[role="combobox"]').nth(1).click();
  await page.getByLabel('Receives copy').click();
  await page.getByRole('button', { name: 'Add Signer' }).click();

  await page.getByRole('textbox', { name: 'Email', exact: true }).nth(1).fill('user3@example.com');
  await page.getByRole('textbox', { name: 'Name', exact: true }).nth(1).fill('User 3');
  await page.locator('button[role="combobox"]').nth(2).click();
  await page.getByLabel('Approver').click();
  await page.getByRole('button', { name: 'Add Signer' }).click();

  await page.getByRole('textbox', { name: 'Email', exact: true }).nth(2).fill('user4@example.com');
  await page.getByRole('textbox', { name: 'Name', exact: true }).nth(2).fill('User 4');
  await page.locator('button[role="combobox"]').nth(3).click();
  await page.getByLabel('Viewer').click();

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
  await page.getByText('User 3 (user3@example.com)').click();

  await page.getByRole('button', { name: 'User 3 Signature' }).click();
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

  await unseedUser(user.id);
});

test('[DOCUMENT_FLOW]: should be able to create, send and sign a document', async ({ page }) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  const documentTitle = `example-${Date.now()}.pdf`;

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

  // Start signing process
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
  await expect(page.getByRole('dialog').getByText('Complete Signing').first()).toBeVisible();
  await page.getByRole('button', { name: 'Sign' }).click();

  await page.waitForURL(`/sign/${token}/complete`);
  await expect(page.getByText('You have signed')).toBeVisible();

  // Check if document has been signed
  const { status: completedStatus } = await getDocumentByToken(token);
  expect(completedStatus).toBe(DocumentStatus.COMPLETED);

  await unseedUser(user.id);
});

test('[DOCUMENT_FLOW]: should be able to create a document and send a copy', async ({ page }) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  const documentTitle = `example-${Date.now()}.pdf`;

  // Set title
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  await page.getByLabel('Title').fill(documentTitle);

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add signers
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  await page.getByPlaceholder('Email').fill('user1@example.com');
  await page.getByPlaceholder('Name').fill('User 1');
  await page.locator('button[role="combobox"]').click();
  await page.getByLabel('Receives copy').click();

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

  await unseedUser(user.id);
});

test('[DOCUMENT_FLOW]: should be able to approve a document', async ({ page }) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  const documentTitle = `example-${Date.now()}.pdf`;

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
  await page.locator('button[role="combobox"]').nth(1).click();
  await page.getByLabel('Approver').click();

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
  await page.getByRole('link', { name: documentTitle }).click();
  await page.waitForURL(/\/documents\/\d+/);

  // Start signing process
  const url = page.url().split('/');
  const documentId = url[url.length - 1];

  // Sign for sender
  const { token } = await getRecipientByEmail({
    email: 'user1@example.com',
    documentId: Number(documentId),
  });

  await page.goto(`/sign/${token}`);
  await page.waitForURL(`/sign/${token}`);

  // Check if document has been viewed
  const { status } = await getDocumentByToken(token);
  expect(status).toBe(DocumentStatus.PENDING);

  const canvas = page.locator('canvas').nth(1);
  const box = await canvas.boundingBox();

  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
    await page.mouse.up();
  }

  await page.getByTestId('field').nth(0).click();
  await page.getByTestId('field').nth(1).click();

  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('dialog').getByText('Complete Signing').first()).toBeVisible();
  await page.getByRole('button', { name: 'Sign' }).click();

  await page.waitForURL(`/sign/${token}/complete`);
  await expect(page.getByText('You have signed')).toBeVisible();
  await expect(page.getByText('Waiting for others to sign')).toBeVisible();

  // Go back to documents
  await page.goto(`/documents`);
  await page.waitForURL('/documents');
  await expect(page.getByRole('link', { name: documentTitle })).toBeVisible();
  await page.getByRole('link', { name: documentTitle }).click();
  await page.waitForURL(/\/documents\/\d+/);

  // Sign for approver
  const { token: approverToken } = await getRecipientByEmail({
    email: 'user2@example.com',
    documentId: Number(documentId),
  });

  await page.goto(`/sign/${approverToken}`);
  await page.waitForURL(`/sign/${approverToken}`);

  // Check if document has been viewed
  const { status: approverStatus } = await getDocumentByToken(approverToken);
  expect(approverStatus).toBe(DocumentStatus.PENDING);

  const approverCanvas = page.locator('canvas').nth(1);
  const approverCanvasBox = await approverCanvas.boundingBox();

  if (approverCanvasBox) {
    await page.mouse.move(
      approverCanvasBox.x + approverCanvasBox.width / 2,
      approverCanvasBox.y + approverCanvasBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      approverCanvasBox.x + approverCanvasBox.width / 4,
      approverCanvasBox.y + approverCanvasBox.height / 4,
    );
    await page.mouse.up();
  }

  await page.getByTestId('field').nth(0).click();
  await page.getByTestId('field').nth(1).click();

  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('dialog').getByText('Complete Approval').first()).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();

  await page.waitForURL(`/sign/${approverToken}/complete`);
  await expect(page.getByText('You have approved')).toBeVisible();

  // Check if document has been signed completely
  const { status: completedStatus } = await getDocumentByToken(approverToken);
  expect(completedStatus).toBe(DocumentStatus.COMPLETED);

  await unseedUser(user.id);
});

test('[DOCUMENT_FLOW]: should be able to create, send with redirect url, sign a document and redirect to redirect url', async ({
  page,
}) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  const documentTitle = `example-${Date.now()}.pdf`;

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
  await expect(page.getByRole('dialog').getByText('Complete Signing').first()).toBeVisible();
  await page.getByRole('button', { name: 'Sign' }).click();

  await page.waitForURL('https://documenso.com');

  // Check if document has been signed
  const { status: completedStatus } = await getDocumentByToken(token);
  expect(completedStatus).toBe(DocumentStatus.COMPLETED);

  await unseedUser(user.id);
});
