import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { signFieldWithToken } from '@documenso/lib/server-only/field/sign-field-with-token';
import { getRecipientsForAssistant } from '@documenso/lib/server-only/recipient/get-recipients-for-assistant';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, FieldType, RecipientRole } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

/**
 * A recipient without a signing order sits in the LAST step — the convention
 * `effectiveOrder` encodes and the server sorts by (NULLS LAST). The
 * assistant scoping filters must agree with it:
 *
 * - an ordered assistant may assist a null-order recipient (they are in the
 *   strictly later tail step), and
 * - a null-order assistant may assist NOBODY (nobody comes after the last
 *   step) — historically `signingOrder ?? 0` treated them as FIRST, letting
 *   their token prefill every ordered recipient's fields.
 *
 * Null orders are only produced via the API, which is why no editor-driven
 * test covers this.
 */

const seedAssistantDocument = async (options: {
  assistantOrder: number | null;
  signerOrder: number | null;
  internalVersion?: number;
}) => {
  const { user, team } = await seedUser();
  const { user: assistantUser } = await seedUser();
  const { user: signerUser } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [assistantUser, signerUser],
    recipientsCreateOptions: [
      { signingOrder: options.assistantOrder, role: RecipientRole.ASSISTANT },
      { signingOrder: options.signerOrder, role: RecipientRole.SIGNER },
    ],
    fields: [FieldType.TEXT],
    updateDocumentOptions: {
      internalVersion: options.internalVersion ?? 1,
      documentMeta: {
        upsert: {
          create: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
          update: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
        },
      },
    },
  });

  // The seed returns recipients ordered by signingOrder (nulls last), so
  // positional destructuring would swap roles — select by role instead.
  const assistant = recipients.find((recipient) => recipient.role === RecipientRole.ASSISTANT);
  const signer = recipients.find((recipient) => recipient.role === RecipientRole.SIGNER);

  if (!assistant || !signer) {
    throw new Error('Seeded recipients not found');
  }

  const signerTextField = signer.fields.find((field) => field.type === FieldType.TEXT);

  if (!signerTextField) {
    throw new Error('Seeded text field not found');
  }

  return { assistant, signer, signerTextField };
};

const callSignEnvelopeField = async (page: Page, input: { token: string; fieldId: number }) => {
  return await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.field.sign`, {
    headers: { 'content-type': 'application/json' },
    data: JSON.stringify({
      json: {
        token: input.token,
        fieldId: input.fieldId,
        fieldValue: {
          type: FieldType.TEXT,
          value: 'TEXT',
        },
      },
    }),
  });
};

test('[ASSISTANT_NULL_ORDER]: an ordered assistant can assist a null-order (tail-step) recipient', async () => {
  const { assistant, signer, signerTextField } = await seedAssistantDocument({
    assistantOrder: 1,
    signerOrder: null,
  });

  // The tail-step recipient is strictly later, so they must be assistable.
  const assistableRecipients = await getRecipientsForAssistant({ token: assistant.token });

  expect(assistableRecipients.map((recipient) => recipient.id)).toContain(signer.id);

  // Their non-signature fields must be visible to the assistant.
  const fields = await getFieldsForToken({ token: assistant.token });

  expect(fields.map((field) => field.id)).toContain(signerTextField.id);

  // And prefillable.
  await signFieldWithToken({
    token: assistant.token,
    fieldId: signerTextField.id,
    value: 'TEXT',
  });

  const fieldAfter = await prisma.field.findUniqueOrThrow({ where: { id: signerTextField.id } });

  expect(fieldAfter.inserted).toBe(true);
});

test('[ASSISTANT_NULL_ORDER]: a null-order (tail-step) assistant cannot assist anyone', async () => {
  const { assistant, signer, signerTextField } = await seedAssistantDocument({
    assistantOrder: null,
    signerOrder: 1,
  });

  // The null-order assistant sits in the last step: nobody comes after them.
  const assistableRecipients = await getRecipientsForAssistant({ token: assistant.token });

  expect(assistableRecipients.map((recipient) => recipient.id)).toEqual([assistant.id]);

  // Every ordered recipient is in an EARLIER step — prefilling must fail.
  await expect(
    signFieldWithToken({
      token: assistant.token,
      fieldId: signerTextField.id,
      value: 'TEXT',
    }),
  ).rejects.toThrow();

  const fieldAfter = await prisma.field.findUniqueOrThrow({ where: { id: signerTextField.id } });

  expect(fieldAfter.inserted).toBe(false);
  expect(fieldAfter.id).not.toBe(signer.id); // sanity: distinct entities
});

test('[ASSISTANT_NULL_ORDER]: V2 route allows an ordered assistant to prefill a null-order recipient', async ({
  page,
}) => {
  const { assistant, signerTextField } = await seedAssistantDocument({
    assistantOrder: 1,
    signerOrder: null,
    internalVersion: 2,
  });

  const response = await callSignEnvelopeField(page, {
    token: assistant.token,
    fieldId: signerTextField.id,
  });

  expect(response.ok()).toBeTruthy();

  const fieldAfter = await prisma.field.findUniqueOrThrow({ where: { id: signerTextField.id } });

  expect(fieldAfter.inserted).toBe(true);
});

test('[ASSISTANT_NULL_ORDER]: V2 route rejects a null-order assistant prefilling an ordered recipient', async ({
  page,
}) => {
  const { assistant, signerTextField } = await seedAssistantDocument({
    assistantOrder: null,
    signerOrder: 1,
    internalVersion: 2,
  });

  const response = await callSignEnvelopeField(page, {
    token: assistant.token,
    fieldId: signerTextField.id,
  });

  expect(response.ok()).toBeFalsy();

  const fieldAfter = await prisma.field.findUniqueOrThrow({ where: { id: signerTextField.id } });

  expect(fieldAfter.inserted).toBe(false);
});
