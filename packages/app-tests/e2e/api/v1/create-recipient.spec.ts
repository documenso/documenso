import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { type APIRequestContext, expect, test } from '@playwright/test';
import { FieldType, SigningStatus } from '@prisma/client';

const API_BASE_URL = `${NEXT_PUBLIC_WEBAPP_URL()}/api/v1`;

/**
 * Creating a recipient used to replace the whole recipient list. The existing
 * recipients were sent back without their IDs, so every one of them was deleted
 * and recreated: new IDs and signing links, their fields deleted, and a signed
 * recipient back to unsigned.
 */

const seedApiUser = async () => {
  const { user, team } = await seedUser();

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'create-recipient',
    expiresIn: null,
  });

  return { user, team, token };
};

const createRecipient = async (request: APIRequestContext, token: string, documentId: number, email: string) =>
  await request.post(`${API_BASE_URL}/documents/${documentId}/recipients`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      name: 'New Recipient',
      email,
    },
  });

const getRecipients = async (envelopeId: string) => {
  const recipients = await prisma.recipient.findMany({
    where: { envelopeId },
    include: {
      fields: {
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { id: 'asc' },
  });

  return recipients.map((recipient) => ({
    id: recipient.id,
    email: recipient.email,
    token: recipient.token,
    signingStatus: recipient.signingStatus,
    sendStatus: recipient.sendStatus,
    fields: recipient.fields.map((field) => ({ id: field.id, inserted: field.inserted })),
  }));
};

test('[CREATE_RECIPIENT]: leaves the existing recipients of a pending document untouched', async ({ request }) => {
  const { user, team, token } = await seedApiUser();

  const { document } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: ['signed@documenso.com', 'waiting@documenso.com'],
    recipientsCreateOptions: [{ signingStatus: SigningStatus.SIGNED }, {}],
    fields: [FieldType.SIGNATURE],
  });

  await prisma.field.updateMany({
    where: {
      envelopeId: document.id,
      recipient: { signingStatus: SigningStatus.SIGNED },
    },
    data: { inserted: true },
  });

  const existingRecipients = await getRecipients(document.id);

  const response = await createRecipient(
    request,
    token,
    mapSecondaryIdToDocumentId(document.secondaryId),
    'new@documenso.com',
  );

  expect(response.ok(), await response.text()).toBeTruthy();

  const recipients = await getRecipients(document.id);

  expect(recipients).toEqual([
    ...existingRecipients,
    expect.objectContaining({ email: 'new@documenso.com', signingStatus: SigningStatus.NOT_SIGNED }),
  ]);

  expect((await response.json()).id).toBe(recipients[2].id);
});
