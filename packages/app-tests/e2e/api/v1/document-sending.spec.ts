import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

test.describe('Document API', () => {
  test('sendDocument: should respect sendCompletionEmails setting', async ({ request }) => {
    const user = await seedUser();

    const { document } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: ['signer@example.com'],
    });

    const { token } = await createApiToken({
      userId: user.id,
      tokenName: 'test',
      expiresIn: null,
    });

    // Test with sendCompletionEmails: false
    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/documents/${document.id}/send`,
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
    const updatedDocument = await prisma.document.findUnique({
      where: { id: document.id },
      include: { documentMeta: true },
    });

    expect(updatedDocument?.documentMeta?.emailSettings).toMatchObject({
      documentCompleted: false,
      ownerDocumentCompleted: false,
    });

    // Test with sendCompletionEmails: true
    const response2 = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/documents/${document.id}/send`,
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
    const updatedDocument2 = await prisma.document.findUnique({
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
    const user = await seedUser();

    const { document } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: ['signer@example.com'],
    });

    // Set initial email settings
    await prisma.documentMeta.upsert({
      where: { documentId: document.id },
      create: {
        documentId: document.id,
        emailSettings: {
          documentCompleted: true,
          ownerDocumentCompleted: false,
        },
      },
      update: {
        documentId: document.id,
        emailSettings: {
          documentCompleted: true,
          ownerDocumentCompleted: false,
        },
      },
    });

    const { token } = await createApiToken({
      userId: user.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/documents/${document.id}/send`,
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
    const updatedDocument = await prisma.document.findUnique({
      where: { id: document.id },
      include: { documentMeta: true },
    });

    expect(updatedDocument?.documentMeta?.emailSettings ?? {}).toMatchObject({
      documentCompleted: true,
      ownerDocumentCompleted: false,
    });
  });
});
