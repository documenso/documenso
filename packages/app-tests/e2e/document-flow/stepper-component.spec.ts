import { expect, test } from '@playwright/test';
import {
  DocumentSigningOrder,
  DocumentStatus,
  FieldType,
  RecipientRole,
  SigningStatus,
} from '@prisma/client';
import { DateTime } from 'luxon';
import path from 'node:path';

import { getRecipientByEmail } from '@documenso/lib/server-only/recipient/get-recipient-by-email';
import { prisma } from '@documenso/prisma';
import {
  seedBlankDocument,
  seedPendingDocumentWithFullFields,
} from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';
import { signSignaturePad } from '../fixtures/signature';

// Can't use the function in server-only/document due to it indirectly using
// require imports.
const getDocumentByToken = async (token: string) => {
  return await prisma.document.findFirstOrThrow({
    where: {
      recipients: {
        some: {
          token,
        },
      },
    },
  });
};

test('[DOCUMENT_FLOW]: should be able to upload a PDF document', async ({ page }) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  // Upload document.
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .locator('input[type=file]')
      .nth(1)
      .evaluate((e) => {
        if (e instanceof HTMLInputElement) {
          e.click();
        }
      }),
  ]);

  await fileChooser.setFiles(path.join(__dirname, '../../../../assets/example.pdf'));

  // Wait to be redirected to the edit page.
  await page.waitForURL(new RegExp(`/t/${team.url}/documents/\\d+`));
});

test('[DOCUMENT_FLOW]: should be able to create a document', async ({ page }) => {
  const { user, team } = await seedUser();
  const document = await seedBlankDocument(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
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
  await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL(new RegExp(`/t/${team.url}/documents/\\d+`));

  // Assert document was created
  await expect(page.getByRole('link', { name: documentTitle })).toBeVisible();
});

test('[DOCUMENT_FLOW]: should be able to create a document with multiple recipients', async ({
  page,
}) => {
  const { user, team } = await seedUser();
  const document = await seedBlankDocument(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
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

  await page.getByLabel('Email').nth(1).fill('user2@example.com');
  await page.getByLabel('Name').nth(1).fill('User 2');

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
  await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL(new RegExp(`/t/${team.url}/documents/\\d+`));

  // Assert document was created
  await expect(page.getByRole('link', { name: documentTitle })).toBeVisible();
});

test('[DOCUMENT_FLOW]: should be able to create a document with multiple recipients with different roles', async ({
  page,
}) => {
  const { user, team } = await seedUser();
  const document = await seedBlankDocument(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
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

  await page.getByLabel('Email').nth(1).fill('user2@example.com');
  await page.getByLabel('Name').nth(1).fill('User 2');
  await page.locator('button[role="combobox"]').nth(1).click();
  await page.getByLabel('Receives copy').click();
  await page.getByRole('button', { name: 'Add Signer' }).click();

  await page.getByLabel('Email').nth(2).fill('user3@example.com');
  await page.getByLabel('Name').nth(2).fill('User 3');
  await page.locator('button[role="combobox"]').nth(2).click();
  await page.getByLabel('Needs to approve').click();
  await page.getByRole('button', { name: 'Add Signer' }).click();

  await page.getByLabel('Email').nth(3).fill('user4@example.com');
  await page.getByLabel('Name').nth(3).fill('User 4');
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
  await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL(new RegExp(`/t/${team.url}/documents/\\d+`));

  // Assert document was created
  await expect(page.getByRole('link', { name: 'Test Title' })).toBeVisible();
});

test('[DOCUMENT_FLOW]: should not be able to create a document without signatures', async ({
  page,
}) => {
  const { user, team } = await seedUser();
  const document = await seedBlankDocument(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
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
});

test('[DOCUMENT_FLOW]: should be able to approve a document', async ({ page }) => {
  const { user, team } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
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
    const { token, fields, role } = recipient;

    const signUrl = `/sign/${token}`;

    await page.goto(signUrl);
    await expect(
      page.getByRole('heading', {
        name: role === RecipientRole.SIGNER ? 'Sign Document' : 'Approve Document',
      }),
    ).toBeVisible();

    await signSignaturePad(page);

    for (const field of fields) {
      await page.locator(`#field-${field.id}`).getByRole('button').click();

      await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
    }

    await page
      .getByRole('button', { name: role === RecipientRole.SIGNER ? 'Complete' : 'Approve' })
      .click();
    await page
      .getByRole('button', { name: role === RecipientRole.SIGNER ? 'Sign' : 'Approve' })
      .click();
    await page.waitForURL(`${signUrl}/complete`);
  }
});

test('[DOCUMENT_FLOW]: should be able to create, send with redirect url, sign a document and redirect to redirect url', async ({
  page,
}) => {
  const { user, team } = await seedUser();
  const document = await seedBlankDocument(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
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

  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL(`/t/${team.url}/documents`);

  // Assert document was created
  await expect(page.getByRole('link', { name: documentTitle })).toBeVisible();
  await page.getByRole('link', { name: documentTitle }).click();
  await page.waitForURL(new RegExp(`/t/${team.url}/documents/\\d+`));

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

  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('dialog').getByText('Complete Approval').first()).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();

  await page.waitForURL('https://documenso.com');

  await expect(async () => {
    // Check if document has been signed
    const { status: completedStatus } = await getDocumentByToken(token);

    expect(completedStatus).toBe(DocumentStatus.COMPLETED);
  }).toPass();
});

test('[DOCUMENT_FLOW]: should be able to sign a document with custom date', async ({ page }) => {
  const { user, team } = await seedUser();

  const now = DateTime.utc();

  const { document, recipients } = await seedPendingDocumentWithFullFields({
    teamId: team.id,
    owner: user,
    recipients: ['user1@example.com'],
    fields: [FieldType.DATE],
  });

  const { token, fields } = recipients[0];
  const [recipientField] = fields;

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
      recipient: {
        email: 'user1@example.com',
      },
      documentId: Number(document.id),
    },
  });

  const insertedDate = DateTime.fromFormat(field?.customText ?? '', 'yyyy-MM-dd hh:mm a');

  expect(Math.abs(insertedDate.diff(now).minutes)).toBeLessThanOrEqual(1);

  await expect(async () => {
    // Check if document has been signed
    const { status: completedStatus } = await getDocumentByToken(token);

    expect(completedStatus).toBe(DocumentStatus.COMPLETED);
  }).toPass();
});

test('[DOCUMENT_FLOW]: should be able to create and sign a document with 3 recipients in sequential order', async ({
  page,
}) => {
  const { user, team } = await seedUser();
  const document = await seedBlankDocument(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
  });

  const documentTitle = `Sequential-Signing-${Date.now()}.pdf`;

  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();
  await page.getByLabel('Title').fill(documentTitle);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();
  await page.getByLabel('Enable signing order').check();

  for (let i = 1; i <= 3; i++) {
    if (i > 1) {
      await page.getByRole('button', { name: 'Add Signer' }).click();
    }

    await page
      .getByLabel('Email')
      .nth(i - 1)
      .focus();

    await page
      .getByLabel('Email')
      .nth(i - 1)
      .fill(`user${i}@example.com`);

    await page
      .getByLabel('Name')
      .nth(i - 1)
      .fill(`User ${i}`);
  }

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  for (let i = 1; i <= 3; i++) {
    if (i > 1) {
      await page.getByText(`User ${i} (user${i}@example.com)`).click();
    }
    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 100 * i,
      },
    });
    await page.getByText(`User ${i} (user${i}@example.com)`).click();
  }

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL(new RegExp(`/t/${team.url}/documents/\\d+`));

  await expect(page.getByRole('link', { name: documentTitle })).toBeVisible();

  const createdDocument = await prisma.document.findFirst({
    where: { title: documentTitle },
    include: { recipients: true },
  });

  expect(createdDocument).not.toBeNull();
  expect(createdDocument?.recipients.length).toBe(3);

  for (let i = 0; i < 3; i++) {
    const recipient = createdDocument?.recipients.find(
      (r) => r.email === `user${i + 1}@example.com`,
    );
    expect(recipient).not.toBeNull();

    const fields = await prisma.field.findMany({
      where: { recipientId: recipient?.id, documentId: createdDocument?.id },
    });
    const recipientField = fields[0];

    if (i > 0) {
      const previousRecipient = await prisma.recipient.findFirst({
        where: { email: `user${i}@example.com`, documentId: createdDocument?.id },
      });

      expect(previousRecipient?.signingStatus).toBe(SigningStatus.SIGNED);
    }

    await page.goto(`/sign/${recipient?.token}`);
    await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();
    await signSignaturePad(page);

    await page.locator(`#field-${recipientField.id}`).getByRole('button').click();

    await page.getByRole('button', { name: 'Complete' }).click();
    await page.getByRole('button', { name: 'Sign' }).click();

    await page.waitForURL(`/sign/${recipient?.token}/complete`);
    await expect(page.getByText('Document Signed')).toBeVisible();

    const updatedRecipient = await prisma.recipient.findFirst({
      where: { id: recipient?.id },
    });

    expect(updatedRecipient?.signingStatus).toBe(SigningStatus.SIGNED);
  }

  // Wait for the document to be signed.
  await page.waitForTimeout(5000);

  const finalDocument = await prisma.document.findFirst({
    where: { id: createdDocument?.id },
  });

  expect(finalDocument?.status).toBe(DocumentStatus.COMPLETED);
});

test('[DOCUMENT_FLOW]: should prevent out-of-order signing in sequential mode', async ({
  page,
}) => {
  const { user, team } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    teamId: team.id,
    owner: user,
    recipients: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
    fields: [FieldType.SIGNATURE],
    recipientsCreateOptions: [{ signingOrder: 1 }, { signingOrder: 2 }, { signingOrder: 3 }],
    updateDocumentOptions: {
      documentMeta: {
        create: {
          signingOrder: DocumentSigningOrder.SEQUENTIAL,
        },
      },
    },
  });

  const pendingRecipient = recipients.find((r) => r.signingOrder === 2);

  await page.goto(`/sign/${pendingRecipient?.token}`);

  await expect(page).toHaveURL(`/sign/${pendingRecipient?.token}/waiting`);

  const activeRecipient = recipients.find((r) => r.signingOrder === 1);

  await page.goto(`/sign/${activeRecipient?.token}`);

  await expect(page).not.toHaveURL(`/sign/${activeRecipient?.token}/waiting`);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();
});
