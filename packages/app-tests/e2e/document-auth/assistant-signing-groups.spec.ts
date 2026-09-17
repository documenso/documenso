import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { prisma } from '@documenso/prisma';
import { type APIRequestContext, expect, test } from '@playwright/test';
import { FieldType } from '@prisma/client';

import { apiSeedPendingDocument } from '../fixtures/api-seeds';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

type SeededGroupEnvelope = {
  assistantToken: string;
  assistantOwnTextFieldId: number;
  peerTextFieldId: number;
  peerSignatureFieldId: number;
  laterTextFieldId: number;
  laterSignatureFieldId: number;
};

/**
 * Seeds a pending SEQUENTIAL envelope where the ASSISTANT shares a signing
 * step (duplicate signingOrder) with a SIGNER:
 *
 * - Step 1: ASSISTANT (own TEXT field) + "Peer Signer" (SIGNATURE + TEXT).
 * - Step 2: "Later Signer" (SIGNATURE + TEXT).
 *
 * Product rule under signing groups: assistants only assist STRICTLY LATER
 * steps — never their own group peers — and never insert SIGNATURE fields
 * belonging to anyone else.
 */
const seedGroupedAssistantEnvelope = async (request: APIRequestContext): Promise<SeededGroupEnvelope> => {
  const timestamp = Date.now();

  const peerEmail = `peer-signer-${timestamp}@documenso.com`;
  const laterEmail = `later-signer-${timestamp}@documenso.com`;

  const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
    title: '[TEST] Grouped assistant envelope',
    meta: {
      signingOrder: 'SEQUENTIAL',
    },
    recipients: [
      {
        email: `assistant-${timestamp}@documenso.com`,
        name: 'Assistant',
        role: 'ASSISTANT',
        signingOrder: 1,
      },
      {
        email: peerEmail,
        name: 'Peer Signer',
        role: 'SIGNER',
        signingOrder: 1,
      },
      {
        email: laterEmail,
        name: 'Later Signer',
        role: 'SIGNER',
        signingOrder: 2,
      },
    ],
    fieldsPerRecipient: [
      [{ type: FieldType.TEXT, page: 1, positionX: 5, positionY: 5, width: 5, height: 5 }],
      [
        { type: FieldType.SIGNATURE, page: 1, positionX: 5, positionY: 15, width: 5, height: 5 },
        { type: FieldType.TEXT, page: 1, positionX: 5, positionY: 25, width: 5, height: 5 },
      ],
      [
        { type: FieldType.SIGNATURE, page: 1, positionX: 5, positionY: 35, width: 5, height: 5 },
        { type: FieldType.TEXT, page: 1, positionX: 5, positionY: 45, width: 5, height: 5 },
      ],
    ],
  });

  const assistant = distributeResult.recipients.find((r) => r.role === 'ASSISTANT');
  const peer = distributeResult.recipients.find((r) => r.email === peerEmail);
  const later = distributeResult.recipients.find((r) => r.email === laterEmail);

  if (!assistant || !peer || !later) {
    throw new Error('Seeded recipients not found');
  }

  const fields = await prisma.field.findMany({
    where: { envelopeId: envelope.id },
  });

  const findField = (recipientId: number, type: FieldType) => {
    const field = fields.find((f) => f.recipientId === recipientId && f.type === type);

    if (!field) {
      throw new Error(`Field ${type} not found for recipient ${recipientId}`);
    }

    return field;
  };

  return {
    assistantToken: assistant.token,
    assistantOwnTextFieldId: findField(assistant.id, FieldType.TEXT).id,
    peerTextFieldId: findField(peer.id, FieldType.TEXT).id,
    peerSignatureFieldId: findField(peer.id, FieldType.SIGNATURE).id,
    laterTextFieldId: findField(later.id, FieldType.TEXT).id,
    laterSignatureFieldId: findField(later.id, FieldType.SIGNATURE).id,
  };
};

const trpcMutation = async (request: APIRequestContext, procedure: string, input: Record<string, unknown>) => {
  return await request.post(`${WEBAPP_BASE_URL}/api/trpc/${procedure}`, {
    headers: { 'content-type': 'application/json' },
    data: JSON.stringify({ json: input }),
  });
};

test.describe('[ASSISTANT_SIGNING_GROUPS]: same-step (group peer) field access', () => {
  test('field.signFieldWithToken (V1) rejects a group peer field', async ({ request }) => {
    const { assistantToken, peerTextFieldId } = await seedGroupedAssistantEnvelope(request);

    const res = await trpcMutation(request, 'field.signFieldWithToken', {
      token: assistantToken,
      fieldId: peerTextFieldId,
      value: 'TEXT',
      isBase64: false,
    });

    expect(res.ok()).toBeFalsy();

    const fieldAfter = await prisma.field.findUniqueOrThrow({
      where: { id: peerTextFieldId },
    });

    expect(fieldAfter.inserted).toBe(false);
    expect(fieldAfter.customText).toBe('');
  });

  test('field.removeSignedFieldWithToken (V1) rejects a group peer field', async ({ request }) => {
    const { assistantToken, peerTextFieldId } = await seedGroupedAssistantEnvelope(request);

    // Pre-insert the peer's field so a successful (incorrect) uninsert is detectable.
    await prisma.field.update({
      where: { id: peerTextFieldId },
      data: { inserted: true, customText: 'pre-existing-value' },
    });

    const res = await trpcMutation(request, 'field.removeSignedFieldWithToken', {
      token: assistantToken,
      fieldId: peerTextFieldId,
    });

    expect(res.ok()).toBeFalsy();

    const fieldAfter = await prisma.field.findUniqueOrThrow({
      where: { id: peerTextFieldId },
    });

    expect(fieldAfter.inserted).toBe(true);
    expect(fieldAfter.customText).toBe('pre-existing-value');
  });

  test('envelope.field.sign (V2) rejects a group peer field', async ({ request }) => {
    const { assistantToken, peerTextFieldId } = await seedGroupedAssistantEnvelope(request);

    const res = await trpcMutation(request, 'envelope.field.sign', {
      token: assistantToken,
      fieldId: peerTextFieldId,
      fieldValue: { type: FieldType.TEXT, value: 'TEXT' },
    });

    expect(res.ok()).toBeFalsy();

    const fieldAfter = await prisma.field.findUniqueOrThrow({
      where: { id: peerTextFieldId },
    });

    expect(fieldAfter.inserted).toBe(false);
  });

  test('getFieldsForToken excludes group peer fields but keeps own and later-step fields', async ({ request }) => {
    const {
      assistantToken,
      assistantOwnTextFieldId,
      peerTextFieldId,
      peerSignatureFieldId,
      laterTextFieldId,
      laterSignatureFieldId,
    } = await seedGroupedAssistantEnvelope(request);

    const fields = await getFieldsForToken({ token: assistantToken });
    const fieldIds = fields.map((field) => field.id);

    // Own fields and strictly-later non-signature fields remain visible.
    expect(fieldIds).toContain(assistantOwnTextFieldId);
    expect(fieldIds).toContain(laterTextFieldId);

    // Group peer fields are never visible to the assistant.
    expect(fieldIds).not.toContain(peerTextFieldId);
    expect(fieldIds).not.toContain(peerSignatureFieldId);

    // Signature fields of other recipients are never visible to the assistant.
    expect(fieldIds).not.toContain(laterSignatureFieldId);
  });
});

test.describe('[ASSISTANT_SIGNING_GROUPS]: signature fields of other recipients', () => {
  test('field.signFieldWithToken (V1) rejects inserting a later recipient signature field', async ({ request }) => {
    const { assistantToken, laterSignatureFieldId } = await seedGroupedAssistantEnvelope(request);

    const res = await trpcMutation(request, 'field.signFieldWithToken', {
      token: assistantToken,
      fieldId: laterSignatureFieldId,
      value: 'John Doe',
      isBase64: false,
    });

    expect(res.ok()).toBeFalsy();

    const fieldAfter = await prisma.field.findUniqueOrThrow({
      where: { id: laterSignatureFieldId },
      include: { signature: true },
    });

    expect(fieldAfter.inserted).toBe(false);
    expect(fieldAfter.signature).toBeNull();
  });
});

test.describe('[ASSISTANT_SIGNING_GROUPS]: preserved assistant abilities', () => {
  test('field.signFieldWithToken (V1) still allows filling the assistant own field', async ({ request }) => {
    const { assistantToken, assistantOwnTextFieldId } = await seedGroupedAssistantEnvelope(request);

    const res = await trpcMutation(request, 'field.signFieldWithToken', {
      token: assistantToken,
      fieldId: assistantOwnTextFieldId,
      value: 'MY OWN TEXT',
      isBase64: false,
    });

    expect(res.ok(), await res.text()).toBeTruthy();

    const fieldAfter = await prisma.field.findUniqueOrThrow({
      where: { id: assistantOwnTextFieldId },
    });

    expect(fieldAfter.inserted).toBe(true);
    expect(fieldAfter.customText).toBe('MY OWN TEXT');
  });

  test('field.signFieldWithToken (V1) still allows prefilling a later recipient text field', async ({ request }) => {
    const { assistantToken, laterTextFieldId } = await seedGroupedAssistantEnvelope(request);

    const res = await trpcMutation(request, 'field.signFieldWithToken', {
      token: assistantToken,
      fieldId: laterTextFieldId,
      value: 'PREFILLED FOR LATER SIGNER',
      isBase64: false,
    });

    expect(res.ok(), await res.text()).toBeTruthy();

    const fieldAfter = await prisma.field.findUniqueOrThrow({
      where: { id: laterTextFieldId },
    });

    expect(fieldAfter.inserted).toBe(true);
    expect(fieldAfter.customText).toBe('PREFILLED FOR LATER SIGNER');
  });
});
