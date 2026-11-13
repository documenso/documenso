import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { EMBED_SIGNATURES_PER_RECIPIENT_LIMIT } from '@documenso/lib/server-only/embedding/upsert-embed-signature';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { FieldType, SigningStatus } from '@prisma/client';

import { WEBAPP_ORIGIN_HEADERS } from '../../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

const callPersistEmbedSignature = async (
  page: Page,
  input: { token: string; clientUserId: string; signature: string },
) => {
  return await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/embeddingPresign.persistEmbedSignature`, {
    headers: { ...WEBAPP_ORIGIN_HEADERS, 'content-type': 'application/json' },
    data: JSON.stringify({ json: input }),
  });
};

const seedRecipient = async () => {
  const { user: owner, team } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner,
    teamId: team.id,
    recipients: ['persist-api-signer@test.documenso.com'],
    fields: [FieldType.SIGNATURE],
    updateDocumentOptions: { internalVersion: 2 },
  });

  return recipients[0];
};

test('[PERSIST_EMBED_SIGNATURE]: caps the number of rows a single recipient can create', async ({ page }) => {
  const recipient = await seedRecipient();

  for (let i = 0; i < EMBED_SIGNATURES_PER_RECIPIENT_LIMIT; i++) {
    const response = await callPersistEmbedSignature(page, {
      token: recipient.token,
      clientUserId: `usr_${i}`,
      signature: `Signer ${i}`,
    });

    expect(response.status()).toBe(200);
  }

  const overflow = await callPersistEmbedSignature(page, {
    token: recipient.token,
    clientUserId: 'usr_overflow',
    signature: 'Overflow',
  });

  expect(overflow.ok()).toBe(false);

  // Overwriting an existing identity is still allowed at the cap.
  const overwrite = await callPersistEmbedSignature(page, {
    token: recipient.token,
    clientUserId: 'usr_0',
    signature: 'Signer 0 updated',
  });

  expect(overwrite.status()).toBe(200);

  expect(await prisma.embedSignature.count({ where: { recipientId: recipient.id } })).toBe(
    EMBED_SIGNATURES_PER_RECIPIENT_LIMIT,
  );
});

test('[PERSIST_EMBED_SIGNATURE]: rejects recipients that can no longer sign', async ({ page }) => {
  const signedRecipient = await seedRecipient();
  const expiredRecipient = await seedRecipient();

  await prisma.recipient.update({
    where: { id: signedRecipient.id },
    data: { signingStatus: SigningStatus.SIGNED },
  });

  await prisma.recipient.update({
    where: { id: expiredRecipient.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });

  for (const recipient of [signedRecipient, expiredRecipient]) {
    const response = await callPersistEmbedSignature(page, {
      token: recipient.token,
      clientUserId: 'usr_blocked',
      signature: 'Blocked',
    });

    expect(response.status()).toBe(404);
  }

  expect(
    await prisma.embedSignature.count({
      where: { recipientId: { in: [signedRecipient.id, expiredRecipient.id] } },
    }),
  ).toBe(0);
});

test('[PERSIST_EMBED_SIGNATURE]: rejects a non-PNG payload behind the image prefix', async ({ page }) => {
  const recipient = await seedRecipient();

  const response = await callPersistEmbedSignature(page, {
    token: recipient.token,
    clientUserId: 'usr_blob',
    signature: `data:image/png;base64,${'A'.repeat(4096)}`,
  });

  expect(response.status()).toBe(400);
  expect(await prisma.embedSignature.count({ where: { recipientId: recipient.id } })).toBe(0);
});
