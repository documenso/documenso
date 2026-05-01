import { type APIRequestContext, expect, test } from '@playwright/test';
import { FieldType, SigningStatus } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';

import { apiSeedPendingDocument } from '../fixtures/api-seeds';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

type SeededEnvelopes = {
  assistantToken: string;
  otherEnvelopeFieldId: number;
};

/**
 * Seeds two unrelated pending envelopes:
 * - Envelope A has an ASSISTANT (with a token) plus a SIGNER.
 * - Envelope B is owned by a different user and has a SIGNER with a TEXT field.
 *
 * Returns the assistant's token from envelope A and the TEXT field id from
 * envelope B so callers can exercise signing routes across envelopes.
 */
const seedTwoPendingEnvelopes = async (request: APIRequestContext): Promise<SeededEnvelopes> => {
  const envelopeA = await apiSeedPendingDocument(request, {
    title: '[TEST] Envelope A',
    recipients: [
      {
        email: `assistant-${Date.now()}@documenso.com`,
        name: 'Assistant',
        role: 'ASSISTANT',
        signingOrder: 1,
      },
      {
        email: `signer-a-${Date.now()}@documenso.com`,
        name: 'Signer A',
        role: 'SIGNER',
        signingOrder: 2,
      },
    ],
    fieldsPerRecipient: [
      [],
      // SIGNER needs a SIGNATURE field so distribution succeeds.
      [{ type: FieldType.SIGNATURE, page: 1, positionX: 5, positionY: 5, width: 5, height: 5 }],
    ],
  });

  const assistant = envelopeA.distributeResult.recipients.find((r) => r.role === 'ASSISTANT');

  if (!assistant) {
    throw new Error('Assistant recipient not found in envelope A');
  }

  const envelopeB = await apiSeedPendingDocument(request, {
    title: '[TEST] Envelope B',
    recipients: [
      {
        email: `signer-b-${Date.now()}@documenso.com`,
        name: 'Signer B',
        role: 'SIGNER',
        signingOrder: 1,
      },
    ],
    // A TEXT field is used as the cross-envelope target. The V2 route has a
    // separate guard that blocks assistants from signing SIGNATURE fields,
    // which would mask whether the recipient lookup itself was scoped.
    fieldsPerRecipient: [
      [
        { type: FieldType.SIGNATURE, page: 1, positionX: 5, positionY: 5, width: 5, height: 5 },
        { type: FieldType.TEXT, page: 1, positionX: 5, positionY: 15, width: 5, height: 5 },
      ],
    ],
  });

  const otherEnvelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeB.envelope.id },
    include: { fields: true },
  });

  const textField = otherEnvelope.fields.find((f) => f.type === FieldType.TEXT);

  if (!textField) {
    throw new Error('TEXT field not found in envelope B');
  }

  return {
    assistantToken: assistant.token,
    otherEnvelopeFieldId: textField.id,
  };
};

const trpcMutation = async (
  request: APIRequestContext,
  procedure: string,
  input: Record<string, unknown>,
) => {
  return await request.post(`${WEBAPP_BASE_URL}/api/trpc/${procedure}`, {
    headers: { 'content-type': 'application/json' },
    data: JSON.stringify({ json: input }),
  });
};

test.describe('[ASSISTANT_SIGNING_AUTH]: cross-envelope field access', () => {
  test('envelope.field.sign (V2) rejects fieldId from another envelope', async ({ request }) => {
    const { assistantToken, otherEnvelopeFieldId } = await seedTwoPendingEnvelopes(request);

    const res = await trpcMutation(request, 'envelope.field.sign', {
      token: assistantToken,
      fieldId: otherEnvelopeFieldId,
      fieldValue: { type: FieldType.TEXT, value: 'TEXT' },
    });

    expect(res.ok()).toBeFalsy();

    const fieldAfter = await prisma.field.findUniqueOrThrow({
      where: { id: otherEnvelopeFieldId },
    });

    expect(fieldAfter.inserted).toBe(false);
    expect(fieldAfter.customText).toBe('');
  });

  test('field.signFieldWithToken (V1) rejects fieldId from another envelope', async ({
    request,
  }) => {
    const { assistantToken, otherEnvelopeFieldId } = await seedTwoPendingEnvelopes(request);

    const res = await trpcMutation(request, 'field.signFieldWithToken', {
      token: assistantToken,
      fieldId: otherEnvelopeFieldId,
      value: 'TEXT',
      isBase64: false,
    });

    expect(res.ok()).toBeFalsy();

    const fieldAfter = await prisma.field.findUniqueOrThrow({
      where: { id: otherEnvelopeFieldId },
    });

    expect(fieldAfter.inserted).toBe(false);
    expect(fieldAfter.customText).toBe('');
  });

  test('field.removeSignedFieldWithToken (V1) rejects fieldId from another envelope', async ({
    request,
  }) => {
    const { assistantToken, otherEnvelopeFieldId } = await seedTwoPendingEnvelopes(request);

    // Pre-insert the field so a successful (incorrect) uninsert is detectable.
    await prisma.field.update({
      where: { id: otherEnvelopeFieldId },
      data: { inserted: true, customText: 'pre-existing-value' },
    });

    const res = await trpcMutation(request, 'field.removeSignedFieldWithToken', {
      token: assistantToken,
      fieldId: otherEnvelopeFieldId,
    });

    expect(res.ok()).toBeFalsy();

    const fieldAfter = await prisma.field.findUniqueOrThrow({
      where: { id: otherEnvelopeFieldId },
      include: { recipient: true },
    });

    expect(fieldAfter.inserted).toBe(true);
    expect(fieldAfter.customText).toBe('pre-existing-value');
    expect(fieldAfter.recipient.signingStatus).toBe(SigningStatus.NOT_SIGNED);
  });
});
