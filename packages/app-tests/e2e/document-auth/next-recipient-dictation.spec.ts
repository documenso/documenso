import { expect, test } from '@playwright/test';
import {
  DocumentSigningOrder,
  DocumentStatus,
  FieldType,
  RecipientRole,
  SigningStatus,
} from '@prisma/client';

import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { signDirectSignaturePad, signSignaturePad } from '../fixtures/signature';

test('[NEXT_RECIPIENT_DICTATION]: should allow updating next recipient when dictation is enabled', async ({
  page,
}) => {
  const { user, team } = await seedUser();
  const { user: firstSigner } = await seedUser();
  const { user: secondSigner } = await seedUser();
  const { user: thirdSigner } = await seedUser();

  const { recipients, document } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [firstSigner, secondSigner, thirdSigner],
    recipientsCreateOptions: [{ signingOrder: 1 }, { signingOrder: 2 }, { signingOrder: 3 }],
    updateDocumentOptions: {
      documentMeta: {
        upsert: {
          create: {
            allowDictateNextSigner: true,
            signingOrder: DocumentSigningOrder.SEQUENTIAL,
          },
          update: {
            allowDictateNextSigner: true,
            signingOrder: DocumentSigningOrder.SEQUENTIAL,
          },
        },
      },
    },
  });

  const firstRecipient = recipients[0];
  const { token, fields } = firstRecipient;

  const signUrl = `/sign/${token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  // Fill in all fields
  for (const field of fields) {
    await page.locator(`#field-${field.id}`).getByRole('button').click();

    if (field.type === FieldType.TEXT) {
      await page.locator('#custom-text').fill('TEXT');
      await page.getByRole('button', { name: 'Save' }).click();
    }

    await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
  }

  // Complete signing and update next recipient
  await page.getByRole('button', { name: 'Complete' }).click();

  // Verify next recipient info is shown
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Next Recipient Name')).toBeVisible();

  // Use dialog context to ensure we're targeting the correct form fields
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('New Recipient');
  await dialog.getByLabel('Email').fill('new.recipient@example.com');

  // Submit and verify completion
  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(`${signUrl}/complete`);

  // Verify document and recipient states
  const updatedDocument = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: {
      recipients: {
        orderBy: { signingOrder: 'asc' },
      },
    },
  });

  // Document should still be pending as there are more recipients
  expect(updatedDocument.status).toBe(DocumentStatus.PENDING);

  // First recipient should be completed
  const updatedFirstRecipient = updatedDocument.recipients[0];
  expect(updatedFirstRecipient.signingStatus).toBe(SigningStatus.SIGNED);

  // Second recipient should be the new recipient
  const updatedSecondRecipient = updatedDocument.recipients[1];
  expect(updatedSecondRecipient.name).toBe('New Recipient');
  expect(updatedSecondRecipient.email).toBe('new.recipient@example.com');
  expect(updatedSecondRecipient.signingOrder).toBe(2);
  expect(updatedSecondRecipient.signingStatus).toBe(SigningStatus.NOT_SIGNED);
});

test('[NEXT_RECIPIENT_DICTATION]: should not show dictation UI when disabled', async ({ page }) => {
  const { user, team } = await seedUser();
  const { user: firstSigner } = await seedUser();
  const { user: secondSigner } = await seedUser();

  const { recipients, document } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [firstSigner, secondSigner],
    recipientsCreateOptions: [{ signingOrder: 1 }, { signingOrder: 2 }],
    updateDocumentOptions: {
      documentMeta: {
        upsert: {
          create: {
            allowDictateNextSigner: false,
            signingOrder: DocumentSigningOrder.SEQUENTIAL,
          },
          update: {
            allowDictateNextSigner: false,
            signingOrder: DocumentSigningOrder.SEQUENTIAL,
          },
        },
      },
    },
  });

  const firstRecipient = recipients[0];
  const { token, fields } = firstRecipient;

  const signUrl = `/sign/${token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  // Fill in all fields
  for (const field of fields) {
    await page.locator(`#field-${field.id}`).getByRole('button').click();

    if (field.type === FieldType.TEXT) {
      await page.locator('#custom-text').fill('TEXT');
      await page.getByRole('button', { name: 'Save' }).click();
    }

    await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
  }

  // Complete signing
  await page.getByRole('button', { name: 'Complete' }).click();

  // Verify next recipient UI is not shown
  await expect(
    page.getByText('The next recipient to sign this document will be'),
  ).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Update Recipient' })).not.toBeVisible();

  // Submit and verify completion
  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(`${signUrl}/complete`);

  // Verify document and recipient states

  const updatedDocument = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: {
      recipients: {
        orderBy: { signingOrder: 'asc' },
      },
    },
  });

  // Document should still be pending as there are more recipients
  expect(updatedDocument.status).toBe(DocumentStatus.PENDING);

  // First recipient should be completed
  const updatedFirstRecipient = updatedDocument.recipients[0];
  expect(updatedFirstRecipient.signingStatus).toBe(SigningStatus.SIGNED);

  // Second recipient should remain unchanged
  const updatedSecondRecipient = updatedDocument.recipients[1];
  expect(updatedSecondRecipient.email).toBe(secondSigner.email);
  expect(updatedSecondRecipient.signingOrder).toBe(2);
  expect(updatedSecondRecipient.signingStatus).toBe(SigningStatus.NOT_SIGNED);
});

test('[NEXT_RECIPIENT_DICTATION]: should work with parallel signing flow', async ({ page }) => {
  const { user, team } = await seedUser();
  const { user: firstSigner } = await seedUser();
  const { user: secondSigner } = await seedUser();

  const { recipients, document } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [firstSigner, secondSigner],
    recipientsCreateOptions: [{ signingOrder: 1 }, { signingOrder: 2 }],
    updateDocumentOptions: {
      documentMeta: {
        upsert: {
          create: {
            allowDictateNextSigner: false,
            signingOrder: DocumentSigningOrder.PARALLEL,
          },
          update: {
            allowDictateNextSigner: false,
            signingOrder: DocumentSigningOrder.PARALLEL,
          },
        },
      },
    },
  });

  // Test both recipients can sign in parallel
  for (const recipient of recipients) {
    const { token, fields } = recipient;
    const signUrl = `/sign/${token}`;

    await page.goto(signUrl);
    await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

    await signSignaturePad(page);

    // Fill in all fields
    for (const field of fields) {
      await page.locator(`#field-${field.id}`).getByRole('button').click();

      if (field.type === FieldType.TEXT) {
        await page.locator('#custom-text').fill('TEXT');
        await page.getByRole('button', { name: 'Save' }).click();
      }

      await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
    }

    // Complete signing
    await page.getByRole('button', { name: 'Complete' }).click();

    // Verify next recipient UI is not shown in parallel flow
    await expect(
      page.getByText('The next recipient to sign this document will be'),
    ).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Update Recipient' })).not.toBeVisible();

    // Submit and verify completion
    await page.getByRole('button', { name: 'Sign' }).click();
    await page.waitForURL(`${signUrl}/complete`);
  }

  // Verify final document and recipient states
  await expect(async () => {
    const updatedDocument = await prisma.envelope.findUniqueOrThrow({
      where: { id: document.id },
      include: {
        recipients: {
          orderBy: { signingOrder: 'asc' },
        },
      },
    });

    // Document should be completed since all recipients have signed
    expect(updatedDocument.status).toBe(DocumentStatus.COMPLETED);

    // All recipients should be completed
    for (const recipient of updatedDocument.recipients) {
      expect(recipient.signingStatus).toBe(SigningStatus.SIGNED);
    }
  }).toPass();
});

test('[NEXT_RECIPIENT_DICTATION]: should allow assistant to dictate next signer', async ({
  page,
}) => {
  const { user, team } = await seedUser();
  const { user: assistant } = await seedUser();
  const { user: signer } = await seedUser();
  const { user: thirdSigner } = await seedUser();

  const { recipients, document } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [assistant, signer, thirdSigner],
    recipientsCreateOptions: [
      { signingOrder: 1, role: RecipientRole.ASSISTANT },
      { signingOrder: 2, role: RecipientRole.SIGNER },
      { signingOrder: 3, role: RecipientRole.SIGNER },
    ],
  });

  await prisma.documentMeta.update({
    where: { id: document.documentMetaId },
    data: {
      allowDictateNextSigner: true,
      signingOrder: DocumentSigningOrder.SEQUENTIAL,
    },
  });

  const assistantRecipient = recipients[0];
  const { token, fields } = assistantRecipient;

  const signUrl = `/sign/${token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Assist Document' })).toBeVisible();

  await page.waitForTimeout(1000);

  await page.getByRole('radio', { name: assistantRecipient.name }).click();

  // Fill in all fields
  for (const field of fields) {
    await page.locator(`#field-${field.id}`).getByRole('button').click();

    if (field.type === FieldType.SIGNATURE) {
      await signDirectSignaturePad(page);
      await page.getByRole('button', { name: 'Sign', exact: true }).click();
    }

    if (field.type === FieldType.TEXT) {
      await page.locator('#custom-text').fill('TEXT');
      await page.getByRole('button', { name: 'Save' }).click();
    }

    await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
  }

  // Complete assisting and update next recipient
  await page.getByRole('button', { name: 'Continue' }).click();

  // Verify next recipient info is shown
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('The next recipient to sign this document will be')).toBeVisible();

  // Update next recipient
  await page.locator('button').filter({ hasText: 'Update Recipient' }).click();
  await page.waitForTimeout(1000);

  // Use dialog context to ensure we're targeting the correct form fields
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('New Recipient');
  await dialog.getByLabel('Email').fill('new.recipient@example.com');

  // Submit and verify completion
  await page.getByRole('button', { name: /Continue|Proceed/i }).click();
  await page.waitForURL(`${signUrl}/complete`);

  // Verify document and recipient states
  await expect(async () => {
    const updatedDocument = await prisma.envelope.findUniqueOrThrow({
      where: { id: document.id },
      include: {
        recipients: {
          orderBy: { signingOrder: 'asc' },
        },
      },
    });

    // Document should still be pending as there are more recipients
    expect(updatedDocument.status).toBe(DocumentStatus.PENDING);

    // Assistant should be completed
    const updatedAssistant = updatedDocument.recipients[0];
    expect(updatedAssistant.signingStatus).toBe(SigningStatus.SIGNED);
    expect(updatedAssistant.role).toBe(RecipientRole.ASSISTANT);

    // Second recipient should be the new signer
    const updatedSigner = updatedDocument.recipients[1];
    expect(updatedSigner.name).toBe('New Recipient');
    expect(updatedSigner.email).toBe('new.recipient@example.com');
    expect(updatedSigner.signingOrder).toBe(2);
    expect(updatedSigner.signingStatus).toBe(SigningStatus.NOT_SIGNED);
    expect(updatedSigner.role).toBe(RecipientRole.SIGNER);

    // Third recipient should remain unchanged
    const thirdRecipient = updatedDocument.recipients[2];
    expect(thirdRecipient.email).toBe(thirdSigner.email);
    expect(thirdRecipient.signingOrder).toBe(3);
    expect(thirdRecipient.signingStatus).toBe(SigningStatus.NOT_SIGNED);
    expect(thirdRecipient.role).toBe(RecipientRole.SIGNER);
  }).toPass();
});
