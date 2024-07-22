import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';
import path from 'node:path';

import { getRecipientByEmail } from '@documenso/lib/server-only/recipient/get-recipient-by-email';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, FieldType, RecipientRole } from '@documenso/prisma/client';
import {
  seedBlankDocument,
  seedPendingDocumentWithFullFields,
} from '@documenso/prisma/seed/documents';
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

  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Email' }).click();
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
  await page.getByRole('textbox', { name: 'Name', exact: true }).nth(1).fill('User 2');

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add fields
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Email' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 200,
    },
  });

  await page.getByText('User 1 (user1@example.com)').click();
  await page.getByText('User 2 (user2@example.com)').click();

  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 500,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Email' }).click();
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

  // Set title
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();
  await page.getByLabel('Title').fill('Test Title');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Add signers
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  // Add 2 signers.
  await page.getByPlaceholder('Email').fill('user1@example.com');
  await page.getByPlaceholder('Name').fill('User 1');
  await page.getByRole('button', { name: 'Add Signer' }).click();

  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('user2@example.com');
  await page.getByRole('textbox', { name: 'Name', exact: true }).nth(1).fill('User 2');
  await page.locator('button[role="combobox"]').nth(1).click();
  await page.getByLabel('Receives copy').click();
  await page.getByRole('button', { name: 'Add Signer' }).click();

  await page.getByRole('textbox', { name: 'Email', exact: true }).nth(1).fill('user3@example.com');
  await page.getByRole('textbox', { name: 'Name', exact: true }).nth(2).fill('User 3');
  await page.locator('button[role="combobox"]').nth(2).click();
  await page.getByLabel('Needs to approve').click();
  await page.getByRole('button', { name: 'Add Signer' }).click();

  await page.getByRole('textbox', { name: 'Email', exact: true }).nth(2).fill('user4@example.com');
  await page.getByRole('textbox', { name: 'Name', exact: true }).nth(3).fill('User 4');
  await page.locator('button[role="combobox"]').nth(3).click();
  await page.getByLabel('Needs to view').click();

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add fields
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.locator('button[role="combobox"]').nth(0).click();
  await page.getByTitle('User 1 (user1@example.com)').click();

  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Email' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 200,
    },
  });

  await page.locator('button[role="combobox"]').nth(0).click();
  await page.getByTitle('User 3 (user3@example.com)').click();

  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 500,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Email' }).click();
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
  await expect(page.getByRole('link', { name: 'Test Title' })).toBeVisible();

  await unseedUser(user.id);
});

test('[DOCUMENT_FLOW]: should not be able to create a document without signatures', async ({
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

  await page.getByPlaceholder('Email').fill('user1@example.com');
  await page.getByPlaceholder('Name').fill('User 1');

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add fields
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(
    page.getByRole('dialog').getByText('No signature field found').first(),
  ).toBeVisible();

  await unseedUser(user.id);
});

test('[DOCUMENT_FLOW]: should be able to approve a document', async ({ page }) => {
  const user = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: ['user@documenso.com', 'approver@documenso.com'],
    recipientsCreateOptions: [
      {
        email: 'user@documenso.com',
        role: RecipientRole.SIGNER,
      },
      {
        email: 'approver@documenso.com',
        role: RecipientRole.APPROVER,
      },
    ],
    fields: [FieldType.SIGNATURE],
  });

  for (const recipient of recipients) {
    const { token, Field, role } = recipient;

    const signUrl = `/sign/${token}`;

    await page.goto(signUrl);
    await expect(
      page.getByRole('heading', {
        name: role === RecipientRole.SIGNER ? 'Sign Document' : 'Approve Document',
      }),
    ).toBeVisible();

    // Add signature.
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
      await page.mouse.up();
    }

    for (const field of Field) {
      await page.locator(`#field-${field.id}`).getByRole('button').click();

      await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
    }

    await page.getByRole('button', { name: 'Complete' }).click();
    await page
      .getByRole('button', { name: role === RecipientRole.SIGNER ? 'Sign' : 'Approve' })
      .click();
    await page.waitForURL(`${signUrl}/complete`);
  }

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

  await page.getByRole('combobox').click();
  await page.getByLabel('Needs to approve').getByText('Needs to approve').click();

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
  await expect(page.getByRole('dialog').getByText('Complete Approval').first()).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();

  await page.waitForURL('https://documenso.com');

  // Check if document has been signed
  const { status: completedStatus } = await getDocumentByToken(token);
  expect(completedStatus).toBe(DocumentStatus.COMPLETED);

  await unseedUser(user.id);
});

test('[DOCUMENT_FLOW]: should be able to sign a document with custom date', async ({ page }) => {
  const user = await seedUser();
  const customDate = DateTime.utc().toFormat('yyyy-MM-dd hh:mm a');

  const { document, recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: ['user1@example.com'],
    fields: [FieldType.DATE],
  });

  const { token, Field } = recipients[0];
  const [recipientField] = Field;

  await page.goto(`/sign/${token}`);
  await page.waitForURL(`/sign/${token}`);

  await page.locator(`#field-${recipientField.id}`).getByRole('button').click();

  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('dialog').getByText('Complete Signing').first()).toBeVisible();
  await page.getByRole('button', { name: 'Sign' }).click();

  await page.waitForURL(`/sign/${token}/complete`);
  await expect(page.getByText('Document Signed')).toBeVisible();

  const field = await prisma.field.findFirst({
    where: {
      Recipient: {
        email: 'user1@example.com',
      },
      documentId: Number(document.id),
    },
  });

  expect(field?.customText).toBe(customDate);

  // Check if document has been signed
  const { status: completedStatus } = await getDocumentByToken(token);
  expect(completedStatus).toBe(DocumentStatus.COMPLETED);

  await unseedUser(user.id);
});
