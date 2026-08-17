import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import {
  DocumentSigningOrder,
  DocumentStatus,
  FieldType,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '@documenso/prisma/client';
import { seedBlankDocument, seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { nanoid } from 'nanoid';

import { signSignaturePad } from '../../fixtures/signature';

test.describe('Document API', () => {
  test('sendDocument: should respect sendCompletionEmails setting', async ({ request }) => {
    const { user, team } = await seedUser();

    const { document } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: ['signer@example.com'],
      teamId: team.id,
    });

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    // Test with sendCompletionEmails: false
    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/send`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          sendCompletionEmails: false,
        },
      },
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    // Verify email settings were updated
    const updatedDocument = await prisma.envelope.findUnique({
      where: { id: document.id },
      include: { documentMeta: true },
    });

    expect(updatedDocument?.documentMeta?.emailSettings).toMatchObject({
      documentCompleted: false,
      ownerDocumentCompleted: false,
    });

    // Test with sendCompletionEmails: true
    const response2 = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/send`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          sendCompletionEmails: true,
        },
      },
    );

    expect(response2.ok()).toBeTruthy();
    expect(response2.status()).toBe(200);

    // Verify email settings were updated
    const updatedDocument2 = await prisma.envelope.findUnique({
      where: { id: document.id },
      include: { documentMeta: true },
    });

    expect(updatedDocument2?.documentMeta?.emailSettings ?? {}).toMatchObject({
      documentCompleted: true,
      ownerDocumentCompleted: true,
    });
  });

  test('sendDocument: should not modify email settings when sendCompletionEmails is not provided', async ({
    request,
  }) => {
    const { user, team } = await seedUser();

    const { document } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: ['signer@example.com'],
      teamId: team.id,
    });

    // Set initial email settings
    await prisma.documentMeta.upsert({
      where: { id: document.documentMetaId },
      create: {
        id: document.documentMetaId,
        emailSettings: {
          documentCompleted: true,
          ownerDocumentCompleted: false,
        },
      },
      update: {
        id: document.documentMetaId,
        emailSettings: {
          documentCompleted: true,
          ownerDocumentCompleted: false,
        },
      },
    });

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/send`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          sendEmail: true,
        },
      },
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    // Verify email settings were not modified
    const updatedDocument = await prisma.envelope.findUnique({
      where: { id: document.id },
      include: { documentMeta: true },
    });

    expect(updatedDocument?.documentMeta?.emailSettings ?? {}).toMatchObject({
      documentCompleted: true,
      ownerDocumentCompleted: false,
    });
  });

  test('sendDocument: should fail when signer has no signature field', async ({ request }) => {
    const { user, team } = await seedUser();

    // Create a blank document and get it with envelope items
    const blankDocument = await seedBlankDocument(user, team.id);
    const document = await prisma.envelope.findUniqueOrThrow({
      where: { id: blankDocument.id },
      include: { envelopeItems: true },
    });

    // Add a signer recipient without any fields
    await prisma.recipient.create({
      data: {
        email: 'signer@example.com',
        name: 'Test Signer',
        role: RecipientRole.SIGNER,
        token: 'test-token-1',
        envelopeId: document.id,
      },
    });

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/send`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {},
      },
    );

    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(400);
  });

  test('sendDocument: should fail when signer has only non-signature fields', async ({ request }) => {
    const { user, team } = await seedUser();

    // Create a blank document and get it with envelope items
    const blankDocument = await seedBlankDocument(user, team.id);
    const document = await prisma.envelope.findUniqueOrThrow({
      where: { id: blankDocument.id },
      include: { envelopeItems: true },
    });

    // Add a signer recipient with only a TEXT field (not signature)
    const recipient = await prisma.recipient.create({
      data: {
        email: 'signer@example.com',
        name: 'Test Signer',
        role: RecipientRole.SIGNER,
        token: 'test-token-2',
        envelopeId: document.id,
      },
    });

    // Add a TEXT field (not a signature field)
    await prisma.field.create({
      data: {
        type: FieldType.TEXT,
        page: 1,
        positionX: 100,
        positionY: 100,
        width: 50,
        height: 50,
        customText: '',
        inserted: false,
        recipientId: recipient.id,
        envelopeId: document.id,
        envelopeItemId: document.envelopeItems[0].id,
      },
    });

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/send`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {},
      },
    );

    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(400);
  });

  test('sendDocument: should succeed when signer has signature field', async ({ request }) => {
    const { user, team } = await seedUser();

    const { document } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: ['signer@example.com'],
      teamId: team.id,
    });

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/send`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {},
      },
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });

  test('sendDocument: should succeed when signer has FREE_SIGNATURE field', async ({ request }) => {
    const { user, team } = await seedUser();

    // Create a blank document and get it with envelope items
    const blankDocument = await seedBlankDocument(user, team.id);
    const document = await prisma.envelope.findUniqueOrThrow({
      where: { id: blankDocument.id },
      include: { envelopeItems: true },
    });

    // Add a signer recipient
    const recipient = await prisma.recipient.create({
      data: {
        email: 'signer@example.com',
        name: 'Test Signer',
        role: RecipientRole.SIGNER,
        token: 'test-token-3',
        envelopeId: document.id,
      },
    });

    // Add a FREE_SIGNATURE field
    await prisma.field.create({
      data: {
        type: FieldType.FREE_SIGNATURE,
        page: 1,
        positionX: 100,
        positionY: 100,
        width: 50,
        height: 50,
        customText: '',
        inserted: false,
        recipientId: recipient.id,
        envelopeId: document.id,
        envelopeItemId: document.envelopeItems[0].id,
      },
    });

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/send`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {},
      },
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });

  test('sendDocument: should succeed when non-signer roles have no fields', async ({ request }) => {
    const { user, team } = await seedUser();

    // Create a blank document and get it with envelope items
    const blankDocument = await seedBlankDocument(user, team.id);
    const document = await prisma.envelope.findUniqueOrThrow({
      where: { id: blankDocument.id },
      include: { envelopeItems: true },
    });

    // Add a signer with signature field
    const signer = await prisma.recipient.create({
      data: {
        email: 'signer@example.com',
        name: 'Test Signer',
        role: RecipientRole.SIGNER,
        token: 'test-token-4',
        envelopeId: document.id,
      },
    });

    await prisma.field.create({
      data: {
        type: FieldType.SIGNATURE,
        page: 1,
        positionX: 1,
        positionY: 1,
        width: 1,
        height: 1,
        customText: '',
        inserted: false,
        recipientId: signer.id,
        envelopeId: document.id,
        envelopeItemId: document.envelopeItems[0].id,
        fieldMeta: { type: 'signature', fontSize: 14 },
      },
    });

    // Add a viewer without any fields
    await prisma.recipient.create({
      data: {
        email: 'viewer@example.com',
        name: 'Test Viewer',
        role: RecipientRole.VIEWER,
        token: 'test-token-5',
        envelopeId: document.id,
      },
    });

    // Add an approver without any fields
    await prisma.recipient.create({
      data: {
        email: 'approver@example.com',
        name: 'Test Approver',
        role: RecipientRole.APPROVER,
        token: 'test-token-6',
        envelopeId: document.id,
      },
    });

    // Add a CC without any fields
    await prisma.recipient.create({
      data: {
        email: 'cc@example.com',
        name: 'Test CC',
        role: RecipientRole.CC,
        token: 'test-token-7',
        envelopeId: document.id,
      },
    });

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/send`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {},
      },
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });

  test('sendDocument: should complete document immediately when all recipients are CC', async ({ request }) => {
    const { user, team } = await seedUser();

    // Create a blank document and get it with envelope items
    const blankDocument = await seedBlankDocument(user, team.id);
    const document = await prisma.envelope.findUniqueOrThrow({
      where: { id: blankDocument.id },
      include: { envelopeItems: true },
    });

    // Add two CC recipients without any fields, mirroring the production
    // state where CC recipients are created pre-signed.
    for (const email of ['cc1@example.com', 'cc2@example.com']) {
      await prisma.recipient.create({
        data: {
          email,
          name: 'Test CC',
          role: RecipientRole.CC,
          signingStatus: SigningStatus.SIGNED,
          sendStatus: SendStatus.SENT,
          token: nanoid(),
          envelopeId: document.id,
        },
      });
    }

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/send`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {},
      },
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    // The document seals asynchronously and completes without anyone signing.
    await expect
      .poll(
        async () => {
          const updatedDocument = await prisma.envelope.findFirstOrThrow({
            where: { id: document.id },
          });

          return updatedDocument.status;
        },
        { timeout: 30_000 },
      )
      .toBe(DocumentStatus.COMPLETED);
  });

  test('sendDocument: should not block initial sequential send when CC recipient is first in signing order', async ({
    request,
    page,
  }) => {
    const { user, team } = await seedUser();

    // Create a blank document and get it with envelope items
    const blankDocument = await seedBlankDocument(user, team.id);
    const document = await prisma.envelope.findUniqueOrThrow({
      where: { id: blankDocument.id },
      include: { envelopeItems: true },
    });

    await prisma.documentMeta.update({
      where: { id: document.documentMetaId },
      data: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
    });

    // CC recipient first in the signing order, mirroring the production
    // state where CC recipients are created pre-signed.
    await prisma.recipient.create({
      data: {
        email: 'cc@example.com',
        name: 'Test CC',
        role: RecipientRole.CC,
        signingOrder: 1,
        signingStatus: SigningStatus.SIGNED,
        sendStatus: SendStatus.SENT,
        token: nanoid(),
        envelopeId: document.id,
      },
    });

    const [signerA, signerB] = await Promise.all(
      [
        { email: 'signer-a@example.com', name: 'Signer A', signingOrder: 2 },
        { email: 'signer-b@example.com', name: 'Signer B', signingOrder: 3 },
      ].map(async ({ email, name, signingOrder }) =>
        prisma.recipient.create({
          data: {
            email,
            name,
            role: RecipientRole.SIGNER,
            signingOrder,
            token: nanoid(),
            envelopeId: document.id,
            fields: {
              create: {
                type: FieldType.SIGNATURE,
                page: 1,
                positionX: signingOrder * 10,
                positionY: 10,
                width: 5,
                height: 5,
                customText: '',
                inserted: false,
                envelopeId: document.id,
                envelopeItemId: document.envelopeItems[0].id,
                fieldMeta: { type: 'signature', fontSize: 14 },
              },
            },
          },
        }),
      ),
    );

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/send`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {},
      },
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    // The CC recipient at order 1 must not block signer A at order 2.
    await page.goto(`/sign/${signerA.token}`);
    await expect(page).not.toHaveURL(`/sign/${signerA.token}/waiting`);
    await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

    // Signer B at order 3 must still wait for signer A.
    await page.goto(`/sign/${signerB.token}`);
    await expect(page).toHaveURL(`/sign/${signerB.token}/waiting`);

    // Sign as signer A then signer B.
    for (const signer of [signerA, signerB]) {
      await page.goto(`/sign/${signer.token}`);
      await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();
      await signSignaturePad(page);

      const signerField = await prisma.field.findFirstOrThrow({
        where: { recipientId: signer.id },
      });

      await page.locator(`#field-${signerField.id}`).getByRole('button').click();

      await page.getByRole('button', { name: 'Complete' }).click();
      await page.getByRole('button', { name: 'Sign' }).click();
      await page.waitForURL(`/sign/${signer.token}/complete`);
    }

    // The document completes without any action from the CC recipient.
    await expect
      .poll(
        async () => {
          const updatedDocument = await prisma.envelope.findFirstOrThrow({
            where: { id: document.id },
          });

          return updatedDocument.status;
        },
        { timeout: 30_000 },
      )
      .toBe(DocumentStatus.COMPLETED);
  });
});
