import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { type APIRequestContext, expect, test } from '@playwright/test';

import { apiSeedDraftDocument } from '../../fixtures/api-seeds';

const API_BASE_URL = `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2-beta`;

/**
 * `Recipient.signingOrder` is an Int column, but nothing constrained the input
 * to an integer. Prisma does not reject a fraction — it truncates it (1.5 -> 1),
 * so distinct orders could silently collapse onto the same value, which under
 * signing groups means "same step". Zero and negatives were persisted as-is and
 * sort ahead of everything, including the `?? 0` fallback in assistant scoping.
 */

const createRecipient = async (request: APIRequestContext, token: string, envelopeId: string, signingOrder: number) =>
  await request.post(`${API_BASE_URL}/envelope/recipient/create-many`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId,
      data: [
        {
          email: `signing-order-${Date.now()}-${signingOrder}@documenso.com`,
          name: 'Signing Order Test',
          role: 'SIGNER',
          signingOrder,
        },
      ],
    },
  });

test('[SIGNING_ORDER_VALIDATION]: rejects a fractional signing order with a client error', async ({ request }) => {
  const { envelope, token } = await apiSeedDraftDocument(request, { title: '[TEST] Signing order validation' });

  const response = await createRecipient(request, token, envelope.id, 1.5);

  expect(response.status()).toBe(400);

  // Nothing may be written — in particular not a silently truncated `1`.
  const recipients = await prisma.recipient.findMany({ where: { envelopeId: envelope.id } });

  expect(recipients).toHaveLength(0);
});

test('[SIGNING_ORDER_VALIDATION]: rejects a zero signing order', async ({ request }) => {
  const { envelope, token } = await apiSeedDraftDocument(request, { title: '[TEST] Signing order validation zero' });

  const response = await createRecipient(request, token, envelope.id, 0);

  expect(response.status()).toBe(400);

  const persisted = await prisma.recipient.findMany({ where: { envelopeId: envelope.id, signingOrder: 0 } });

  expect(persisted).toHaveLength(0);
});

test('[SIGNING_ORDER_VALIDATION]: rejects a negative signing order', async ({ request }) => {
  const { envelope, token } = await apiSeedDraftDocument(request, {
    title: '[TEST] Signing order validation negative',
  });

  const response = await createRecipient(request, token, envelope.id, -1);

  expect(response.status()).toBe(400);

  const persisted = await prisma.recipient.findMany({ where: { envelopeId: envelope.id, signingOrder: -1 } });

  expect(persisted).toHaveLength(0);
});

test('[SIGNING_ORDER_VALIDATION]: still accepts a valid positive integer signing order', async ({ request }) => {
  const { envelope, token } = await apiSeedDraftDocument(request, { title: '[TEST] Signing order validation valid' });

  const response = await createRecipient(request, token, envelope.id, 2);

  expect(response.ok(), await response.text()).toBeTruthy();

  const persisted = await prisma.recipient.findMany({ where: { envelopeId: envelope.id, signingOrder: 2 } });

  expect(persisted).toHaveLength(1);
});
