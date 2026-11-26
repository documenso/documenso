import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { ZRecipientAuthOptionsSchema } from '@documenso/lib/types/document-auth';
import { createRecipientAuthOptions } from '@documenso/lib/utils/document-auth';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { seedTestEmail } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';
import { FieldType, type Recipient } from '@prisma/client';

import { apiSeedPendingDocument } from '../../fixtures/api-seeds';
import { apiSignin, WEBAPP_ORIGIN_HEADERS } from '../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

const signatureFieldAt = (positionY: number) => ({
  type: FieldType.SIGNATURE,
  page: 1,
  positionX: 5,
  positionY,
  width: 20,
  height: 5,
});

const findFields = async (envelopeId: string) =>
  await prisma.field.findMany({
    where: {
      envelopeId,
    },
    include: {
      signature: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

const findRecipients = async (envelopeId: string) =>
  await prisma.recipient.findMany({
    where: {
      envelopeId,
    },
    orderBy: {
      id: 'asc',
    },
  });

type StoredField = Awaited<ReturnType<typeof findFields>>[number];

const toFieldPayload = (field: StoredField) => ({
  id: field.id,
  envelopeItemId: field.envelopeItemId,
  recipientId: field.recipientId,
  type: field.type,
  page: field.page,
  positionX: Number(field.positionX),
  positionY: Number(field.positionY),
  width: Number(field.width),
  height: Number(field.height),
  fieldMeta: field.fieldMeta ?? undefined,
  groupId: field.groupId,
  externalId: field.externalId,
});

// The request schema has no `accessAuth`, so the editor never sends it.
const toRecipientPayload = (recipient: Recipient) => ({
  id: recipient.id,
  email: recipient.email,
  name: recipient.name,
  role: recipient.role,
  signingOrder: recipient.signingOrder ?? undefined,
  actionAuth: ZRecipientAuthOptionsSchema.parse(recipient.authOptions).actionAuth,
});

/**
 * A pending document, opened by its owner, where signer A has signed and completed and signer B
 * has not acted. Signer A also has an access auth requirement, which the editor never sends back.
 */
const seedPartlySignedDocument = async (page: Page) => {
  const request = page.context().request;

  const { envelope, user, team } = await apiSeedPendingDocument(request, {
    recipients: [
      { email: seedTestEmail(), name: 'Signer A' },
      { email: seedTestEmail(), name: 'Signer B' },
    ],
    fieldsPerRecipient: [[signatureFieldAt(5)], [signatureFieldAt(20), signatureFieldAt(35)]],
  });

  const postTrpc = async (procedure: string, json: unknown) =>
    await request.post(`${WEBAPP_BASE_URL}/api/trpc/${procedure}`, {
      headers: { ...WEBAPP_ORIGIN_HEADERS, 'content-type': 'application/json', 'x-team-id': team.id.toString() },
      data: JSON.stringify({ json }),
    });

  const findSigner = async (name: string) =>
    await prisma.recipient.findFirstOrThrow({
      where: {
        envelopeId: envelope.id,
        name,
      },
      include: {
        fields: {
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

  const signerA = await findSigner('Signer A');
  const signerB = await findSigner('Signer B');

  const [signatureA] = signerA.fields;

  const signResponse = await postTrpc('envelope.field.sign', {
    token: signerA.token,
    fieldId: signatureA.id,
    fieldValue: { type: FieldType.SIGNATURE, value: 'Signature A' },
  });

  const completeResponse = await postTrpc('recipient.completeDocumentWithToken', {
    token: signerA.token,
    documentId: mapSecondaryIdToDocumentId(envelope.secondaryId),
  });

  expect(signResponse.status()).toBe(200);
  expect(completeResponse.status()).toBe(200);

  await prisma.recipient.update({
    where: {
      id: signerA.id,
    },
    data: {
      authOptions: createRecipientAuthOptions({
        accessAuth: ['ACCOUNT'],
        actionAuth: [],
      }),
    },
  });

  await apiSignin({ page, email: user.email });

  return {
    envelopeId: envelope.id,
    signerA,
    signerB,
    signatureA,
    saveFields: async (fields: ReturnType<typeof toFieldPayload>[]) =>
      await postTrpc('envelope.field.set', { envelopeId: envelope.id, envelopeType: 'DOCUMENT', fields }),
    saveRecipients: async (recipients: ReturnType<typeof toRecipientPayload>[]) =>
      await postTrpc('envelope.recipient.set', { envelopeId: envelope.id, envelopeType: 'DOCUMENT', recipients }),
  };
};

test.describe('envelope.field.set on a partly signed document', () => {
  test('accepts the unchanged list the editor autosaves', async ({ page }) => {
    const { envelopeId, saveFields } = await seedPartlySignedDocument(page);

    const fieldsBefore = await findFields(envelopeId);

    const response = await saveFields(fieldsBefore.map(toFieldPayload));

    expect(response.status()).toBe(200);
    expect(await findFields(envelopeId)).toEqual(fieldsBefore);
  });

  test('refuses a list which leaves out a field of the signed recipient', async ({ page }) => {
    const { envelopeId, signatureA, saveFields } = await seedPartlySignedDocument(page);

    const fieldsBefore = await findFields(envelopeId);

    const response = await saveFields(fieldsBefore.filter((field) => field.id !== signatureA.id).map(toFieldPayload));

    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('Recipient has already interacted with the document');
    expect(await findFields(envelopeId)).toEqual(fieldsBefore);
  });

  test('deletes a field of the unsigned recipient which the list leaves out', async ({ page }) => {
    const { envelopeId, signerB, saveFields } = await seedPartlySignedDocument(page);

    const fieldsBefore = await findFields(envelopeId);
    const keptFields = fieldsBefore.filter((field) => field.id !== signerB.fields[1].id);

    const response = await saveFields(keptFields.map(toFieldPayload));

    expect(response.status()).toBe(200);
    expect(await findFields(envelopeId)).toEqual(keptFields);
  });

  test('refuses to move a signed field to the unsigned recipient', async ({ page }) => {
    const { envelopeId, signerB, signatureA, saveFields } = await seedPartlySignedDocument(page);

    const fieldsBefore = await findFields(envelopeId);

    // The stored field stays with signer A, so it is signer A who must still be editable.
    const response = await saveFields(
      fieldsBefore
        .map(toFieldPayload)
        .map((field) => (field.id === signatureA.id ? { ...field, recipientId: signerB.id, positionY: 50 } : field)),
    );

    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('Cannot modify a field where the recipient has already interacted');
    expect(await findFields(envelopeId)).toEqual(fieldsBefore);
  });
});

test.describe('envelope.recipient.set on a partly signed document', () => {
  test('accepts the unchanged list the editor autosaves', async ({ page }) => {
    const { envelopeId, saveRecipients } = await seedPartlySignedDocument(page);

    const recipientsBefore = await findRecipients(envelopeId);

    const response = await saveRecipients(recipientsBefore.map(toRecipientPayload));

    expect(response.status()).toBe(200);

    // Not the whole row: a save resets `sendStatus` of a recipient who has not signed.
    const toIdentity = ({ id, token, signingStatus, authOptions }: Recipient) => ({
      id,
      token,
      signingStatus,
      authOptions,
    });

    expect((await findRecipients(envelopeId)).map(toIdentity)).toEqual(recipientsBefore.map(toIdentity));
  });

  test('refuses a list which leaves out the signed recipient', async ({ page }) => {
    const { envelopeId, signerA, saveRecipients } = await seedPartlySignedDocument(page);

    const recipientsBefore = await findRecipients(envelopeId);
    const fieldsBefore = await findFields(envelopeId);

    const response = await saveRecipients(
      recipientsBefore.filter((recipient) => recipient.id !== signerA.id).map(toRecipientPayload),
    );

    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('Recipient has already interacted with the document');
    expect(await findRecipients(envelopeId)).toEqual(recipientsBefore);
    expect(await findFields(envelopeId)).toEqual(fieldsBefore);
  });

  test('deletes the unsigned recipient when the list leaves them out', async ({ page }) => {
    const { envelopeId, signerA, signerB, saveRecipients } = await seedPartlySignedDocument(page);

    const recipientsBefore = await findRecipients(envelopeId);

    const response = await saveRecipients(
      recipientsBefore.filter((recipient) => recipient.id !== signerB.id).map(toRecipientPayload),
    );

    expect(response.status()).toBe(200);
    expect((await findRecipients(envelopeId)).map((recipient) => recipient.id)).toEqual([signerA.id]);
  });
});
