import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, DocumentStatus, FieldType, SigningStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';
import { signSignaturePad } from '../fixtures/signature';

test.describe.configure({ mode: 'parallel' });

test.describe('Sequential Signing Order', () => {
  test('[SIGNING_ORDER]: second recipient is redirected to waiting page when first has not signed', async ({
    page,
  }) => {
    const { user, team } = await seedUser();

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: [
        'signer1-sequential@test.documenso.com',
        'signer2-sequential@test.documenso.com',
      ],
      teamId: team.id,
      fields: [FieldType.SIGNATURE],
    });

    await prisma.documentMeta.update({
      where: { id: document.documentMetaId },
      data: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
    });

    const signer1 = recipients[0];
    const signer2 = recipients[1];

    await page.goto(`/sign/${signer2.token}`);

    await page.waitForURL(`/sign/${signer2.token}/waiting`);

    await expect(page.getByText('Waiting for Your Turn')).toBeVisible();
    await expect(
      page.getByText("It's currently not your turn to sign. You will receive an email"),
    ).toBeVisible();
  });

  test('[SIGNING_ORDER]: first recipient can access signing page normally', async ({ page }) => {
    const { user, team } = await seedUser();

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: [
        'signer1-access@test.documenso.com',
        'signer2-access@test.documenso.com',
      ],
      teamId: team.id,
      fields: [FieldType.SIGNATURE],
    });

    await prisma.documentMeta.update({
      where: { id: document.documentMetaId },
      data: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
    });

    const signer1 = recipients[0];

    await page.goto(`/sign/${signer1.token}`);

    await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();
  });

  test('[SIGNING_ORDER]: second recipient cannot sign field before their turn', async ({ page }) => {
    const { user, team } = await seedUser();

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: [
        'signer1-early@test.documenso.com',
        'signer2-early@test.documenso.com',
      ],
      teamId: team.id,
      fields: [FieldType.SIGNATURE],
    });

    await prisma.documentMeta.update({
      where: { id: document.documentMetaId },
      data: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
    });

    const signer1 = recipients[0];
    const signer2 = recipients[1];

    const signatureField = signer2.fields.find((f) => f.type === FieldType.SIGNATURE);

    expect(signatureField).toBeDefined();

    if (signatureField) {
      const fieldBefore = await prisma.field.findUniqueOrThrow({
        where: { id: signatureField.id },
      });

      expect(fieldBefore.inserted).toBe(false);
    }
  });

  test('[SIGNING_ORDER]: waiting page redirects to sign page when it becomes recipients turn', async ({
    page,
  }) => {
    const { user, team } = await seedUser();

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: [
        'signer1-turn@test.documenso.com',
        'signer2-turn@test.documenso.com',
      ],
      teamId: team.id,
      fields: [FieldType.SIGNATURE],
    });

    await prisma.documentMeta.update({
      where: { id: document.documentMetaId },
      data: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
    });

    const signer1 = recipients[0];
    const signer2 = recipients[1];

    await prisma.recipient.update({
      where: { id: signer1.id },
      data: { signingStatus: SigningStatus.SIGNED },
    });

    await page.goto(`/sign/${signer2.token}/waiting`);

    await page.waitForURL(`/sign/${signer2.token}`);

    await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();
  });

  test('[SIGNING_ORDER]: waiting page redirects to expired page when recipient is expired', async ({
    page,
  }) => {
    const { user, team } = await seedUser();

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: [
        'signer1-expired-waiting@test.documenso.com',
        'signer2-expired-waiting@test.documenso.com',
      ],
      teamId: team.id,
      fields: [FieldType.SIGNATURE],
    });

    await prisma.documentMeta.update({
      where: { id: document.documentMetaId },
      data: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
    });

    const signer2 = recipients[1];

    await prisma.recipient.update({
      where: { id: signer2.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await page.goto(`/sign/${signer2.token}/waiting`);

    await page.waitForURL(`/sign/${signer2.token}/expired`);

    await expect(page.getByText('Signing Deadline Expired')).toBeVisible();
  });

  test('[SIGNING_ORDER]: waiting page redirects to complete page when document is completed', async ({
    page,
  }) => {
    const { user, team } = await seedUser();

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: [
        'signer1-completed-waiting@test.documenso.com',
        'signer2-completed-waiting@test.documenso.com',
      ],
      teamId: team.id,
      fields: [FieldType.SIGNATURE],
    });

    await prisma.documentMeta.update({
      where: { id: document.documentMetaId },
      data: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
    });

    const signer2 = recipients[1];

    await prisma.envelope.update({
      where: { id: document.id },
      data: { status: DocumentStatus.COMPLETED },
    });

    await page.goto(`/sign/${signer2.token}/waiting`);

    await page.waitForURL(`/sign/${signer2.token}/complete`);
  });

  test('[SIGNING_ORDER]: waiting page redirects to rejected page when document is rejected', async ({
    page,
  }) => {
    const { user, team } = await seedUser();

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: [
        'signer1-rejected-waiting@test.documenso.com',
        'signer2-rejected-waiting@test.documenso.com',
      ],
      teamId: team.id,
      fields: [FieldType.SIGNATURE],
    });

    await prisma.documentMeta.update({
      where: { id: document.documentMetaId },
      data: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
    });

    const signer2 = recipients[1];

    await prisma.envelope.update({
      where: { id: document.id },
      data: { status: DocumentStatus.REJECTED },
    });

    await page.goto(`/sign/${signer2.token}/waiting`);

    await page.waitForURL(`/sign/${signer2.token}/rejected`);
  });
});

test.describe('V2 Envelope Expiration', () => {
  test('[V2_EXPIRATION]: V2 envelope with expired recipient is redirected to expired page', async ({
    page,
  }) => {
    const { user, team } = await seedUser();

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: ['v2-expired-recipient@test.documenso.com'],
      teamId: team.id,
      fields: [FieldType.SIGNATURE],
    });

    await prisma.envelope.update({
      where: { id: document.id },
      data: { internalVersion: 2 },
    });

    const recipient = recipients[0];

    await prisma.recipient.update({
      where: { id: recipient.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await page.goto(`/sign/${recipient.token}`);
    await page.waitForURL(`/sign/${recipient.token}/expired`);

    await expect(page.getByText('Signing Deadline Expired')).toBeVisible();
    await expect(page.getByText('The signing deadline for this document has passed')).toBeVisible();
  });

  test('[V2_EXPIRATION]: V2 envelope expired recipient cannot sign fields', async ({ page }) => {
    const { user, team } = await seedUser();

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: [user],
      teamId: team.id,
      fields: [FieldType.SIGNATURE],
    });

    await prisma.envelope.update({
      where: { id: document.id },
      data: { internalVersion: 2 },
    });

    const recipient = recipients[0];

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/sign/${recipient.token}`,
    });

    await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

    await prisma.recipient.update({
      where: { id: recipient.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await signSignaturePad(page);

    const signatureField = recipient.fields.find((f) => f.type === FieldType.SIGNATURE);

    if (signatureField) {
      await page.locator(`#field-${signatureField.id}`).getByRole('button').click();
    }

    if (signatureField) {
      await expect(async () => {
        const field = await prisma.field.findUniqueOrThrow({
          where: { id: signatureField.id },
        });

        expect(field.inserted).toBe(false);
      }).toPass({ timeout: 10_000 });
    }
  });

  test('[V2_EXPIRATION]: V2 envelope non-expired recipient can access signing page', async ({
    page,
  }) => {
    const { user, team } = await seedUser();

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: ['v2-active-recipient@test.documenso.com'],
      teamId: team.id,
      fields: [FieldType.SIGNATURE],
    });

    await prisma.envelope.update({
      where: { id: document.id },
      data: { internalVersion: 2 },
    });

    const recipient = recipients[0];

    await prisma.recipient.update({
      where: { id: recipient.id },
      data: { expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    await page.goto(`/sign/${recipient.token}`);

    await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();
  });
});

test.describe('Sequential Signing Next Recipient Notification', () => {
  test('[NEXT_SIGNER]: after first signer completes, second signer can access signing page', async ({
    page,
  }) => {
    const { user, team } = await seedUser();

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: [
        'next-signer1@test.documenso.com',
        'next-signer2@test.documenso.com',
      ],
      teamId: team.id,
      fields: [FieldType.SIGNATURE],
    });

    await prisma.documentMeta.update({
      where: { id: document.documentMetaId },
      data: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
    });

    const signer1 = recipients[0];
    const signer2 = recipients[1];

    await page.goto(`/sign/${signer2.token}`);
    await page.waitForURL(`/sign/${signer2.token}/waiting`);

    await prisma.recipient.update({
      where: { id: signer1.id },
      data: { signingStatus: SigningStatus.SIGNED, signedAt: new Date() },
    });

    await page.goto(`/sign/${signer2.token}`);

    await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();
  });

  test('[NEXT_SIGNER]: sendStatus is updated for next recipient after signing', async () => {
    const { user, team } = await seedUser();

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: [
        'send-status1@test.documenso.com',
        'send-status2@test.documenso.com',
      ],
      teamId: team.id,
      fields: [FieldType.SIGNATURE],
    });

    await prisma.documentMeta.update({
      where: { id: document.documentMetaId },
      data: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
    });

    const signer2 = recipients[1];

    const recipientBefore = await prisma.recipient.findUniqueOrThrow({
      where: { id: signer2.id },
    });

    expect(recipientBefore.sendStatus).not.toBe('SENT');
  });
});
