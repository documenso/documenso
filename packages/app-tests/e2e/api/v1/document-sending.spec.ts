import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { FieldType, RecipientRole } from '@documenso/prisma/client';
import {
  seedBlankDocument,
  seedPendingDocumentWithFullFields,
} from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

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

  test('sendDocument: should fail when signer has only non-signature fields', async ({
    request,
  }) => {
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
});
