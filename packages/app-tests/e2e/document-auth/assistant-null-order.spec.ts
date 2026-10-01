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
 * Assistant scoping must follow the same position model as signing (numbered
 * first, then unordered by id). Historically `signingOrder ?? 0` treated an
 * unordered assistant as FIRST, letting their token prefill every ordered
 * recipient's fields.
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

test('[ASSISTANT_NULL_ORDER]: a null-order assistant cannot assist an ordered recipient', async () => {
  const { assistant, signerTextField } = await seedAssistantDocument({
    assistantOrder: null,
    signerOrder: 1,
  });

  const assistableRecipients = await getRecipientsForAssistant({ token: assistant.token });

  expect(assistableRecipients.map((recipient) => recipient.id)).toEqual([assistant.id]);

  const fields = await getFieldsForToken({ token: assistant.token });

  expect(fields.map((field) => field.id)).not.toContain(signerTextField.id);

  await expect(
    signFieldWithToken({
      token: assistant.token,
      fieldId: signerTextField.id,
      value: 'TEXT',
    }),
  ).rejects.toThrow();

  const fieldAfter = await prisma.field.findUniqueOrThrow({ where: { id: signerTextField.id } });

  expect(fieldAfter.inserted).toBe(false);
});

test('[ASSISTANT_NULL_ORDER]: a null-order assistant can assist a null-order recipient created after them', async () => {
  const { assistant, signer, signerTextField } = await seedAssistantDocument({
    assistantOrder: null,
    signerOrder: null,
  });

  const assistableRecipients = await getRecipientsForAssistant({ token: assistant.token });

  expect(assistableRecipients.map((recipient) => recipient.id)).toEqual([assistant.id, signer.id]);

  const fields = await getFieldsForToken({ token: assistant.token });

  expect(fields.map((field) => field.id)).toContain(signerTextField.id);

  await signFieldWithToken({
    token: assistant.token,
    fieldId: signerTextField.id,
    value: 'TEXT',
  });

  const fieldAfter = await prisma.field.findUniqueOrThrow({ where: { id: signerTextField.id } });

  expect(fieldAfter.inserted).toBe(true);
});

test('[ASSISTANT_NULL_ORDER]: a null-order recipient cannot be assisted by a null-order assistant created after them', async () => {
  const { user, team } = await seedUser();
  const { user: signerUser } = await seedUser();
  const { user: assistantUser } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [signerUser, assistantUser],
    recipientsCreateOptions: [
      { signingOrder: null, role: RecipientRole.SIGNER },
      { signingOrder: null, role: RecipientRole.ASSISTANT },
    ],
    fields: [FieldType.TEXT],
    updateDocumentOptions: {
      documentMeta: {
        upsert: {
          create: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
          update: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
        },
      },
    },
  });

  const assistant = recipients.find((recipient) => recipient.role === RecipientRole.ASSISTANT);
  const signerTextField = recipients
    .find((recipient) => recipient.role === RecipientRole.SIGNER)
    ?.fields.find((field) => field.type === FieldType.TEXT);

  if (!assistant || !signerTextField) {
    throw new Error('Seeded recipients not found');
  }

  const assistableRecipients = await getRecipientsForAssistant({ token: assistant.token });

  expect(assistableRecipients.map((recipient) => recipient.id)).toEqual([assistant.id]);

  await expect(
    signFieldWithToken({
      token: assistant.token,
      fieldId: signerTextField.id,
      value: 'TEXT',
    }),
  ).rejects.toThrow();
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
