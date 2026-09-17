import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { type APIRequestContext, expect, test } from '@playwright/test';

import { apiSeedDraftDocument } from '../../fixtures/api-seeds';

const API_BASE_URL = `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2-beta`;

/**
 * AES/QES envelopes cannot contain signing groups: two recipients sharing a
 * step sign in parallel, which breaks the per-recipient /ByteRange invariant
 * TSP signatures depend on. That rule previously lived only in the editor's
 * form schema, so the API would happily create the forbidden state.
 *
 * The signature level is seeded directly because `resolveSignatureLevel`
 * coerces AES/QES down to SES on a non-CSC instance, so it cannot be requested
 * through the API here.
 */

const createRecipients = async (
  request: APIRequestContext,
  token: string,
  envelopeId: string,
  recipients: Array<{ signingOrder?: number }>,
) =>
  await request.post(`${API_BASE_URL}/envelope/recipient/create-many`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId,
      data: recipients.map((recipient, index) => ({
        email: `tsp-grouping-${Date.now()}-${index}@documenso.com`,
        name: `TSP Recipient ${index}`,
        role: 'SIGNER',
        ...recipient,
      })),
    },
  });

const seedEnvelopeAtSignatureLevel = async (request: APIRequestContext, signatureLevel: string) => {
  const { envelope, token } = await apiSeedDraftDocument(request, { title: `[TEST] ${signatureLevel} grouping` });

  await prisma.envelope.update({ where: { id: envelope.id }, data: { signatureLevel } });

  return { envelopeId: envelope.id, token };
};

test('[TSP_GROUPING]: rejects two recipients sharing a signing order on an AES envelope', async ({ request }) => {
  const { envelopeId, token } = await seedEnvelopeAtSignatureLevel(request, 'AES');

  const response = await createRecipients(request, token, envelopeId, [{ signingOrder: 1 }, { signingOrder: 1 }]);

  expect(response.status()).toBe(400);

  const recipients = await prisma.recipient.findMany({ where: { envelopeId } });

  expect(recipients).toHaveLength(0);
});

test('[TSP_GROUPING]: rejects a second recipient joining an existing step on an AES envelope', async ({ request }) => {
  const { envelopeId, token } = await seedEnvelopeAtSignatureLevel(request, 'AES');

  const first = await createRecipients(request, token, envelopeId, [{ signingOrder: 1 }]);

  expect(first.ok(), await first.text()).toBeTruthy();

  // The payload alone looks fine — only the resulting set reveals the group.
  const second = await createRecipients(request, token, envelopeId, [{ signingOrder: 1 }]);

  expect(second.status()).toBe(400);

  const recipients = await prisma.recipient.findMany({ where: { envelopeId } });

  expect(recipients).toHaveLength(1);
});

test('[TSP_GROUPING]: rejects two recipients without a signing order on a QES envelope', async ({ request }) => {
  const { envelopeId, token } = await seedEnvelopeAtSignatureLevel(request, 'QES');

  // Both land in the same tail step, so they would sign in parallel.
  const response = await createRecipients(request, token, envelopeId, [{}, {}]);

  expect(response.status()).toBe(400);

  const recipients = await prisma.recipient.findMany({ where: { envelopeId } });

  expect(recipients).toHaveLength(0);
});

test('[TSP_GROUPING]: accepts distinct signing orders on an AES envelope', async ({ request }) => {
  const { envelopeId, token } = await seedEnvelopeAtSignatureLevel(request, 'AES');

  const response = await createRecipients(request, token, envelopeId, [{ signingOrder: 1 }, { signingOrder: 2 }]);

  expect(response.ok(), await response.text()).toBeTruthy();

  const recipients = await prisma.recipient.findMany({ where: { envelopeId } });

  expect(recipients).toHaveLength(2);
});

test('[TSP_GROUPING]: still allows signing groups on an SES envelope', async ({ request }) => {
  const { envelopeId, token } = await seedEnvelopeAtSignatureLevel(request, 'SES');

  const response = await createRecipients(request, token, envelopeId, [{ signingOrder: 1 }, { signingOrder: 1 }]);

  expect(response.ok(), await response.text()).toBeTruthy();

  const recipients = await prisma.recipient.findMany({ where: { envelopeId } });

  expect(recipients.map((recipient) => recipient.signingOrder)).toEqual([1, 1]);
});
