import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { FieldType } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

/**
 * Field insertion must respect the recipient's signing window: an expired
 * recipient can no longer act on the envelope at all. The V1 endpoints assert
 * this; the V2 `envelope.field.sign` route historically did not.
 */

const callSignEnvelopeField = async (page: Page, input: { token: string; fieldId: number; value: string }) => {
  return await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.field.sign`, {
    headers: { 'content-type': 'application/json' },
    data: JSON.stringify({
      json: {
        token: input.token,
        fieldId: input.fieldId,
        fieldValue: {
          type: FieldType.TEXT,
          value: input.value,
        },
      },
    }),
  });
};

const seedV2PendingDocumentWithTextField = async () => {
  const { user, team } = await seedUser();
  const { user: signer } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [signer],
    fields: [FieldType.TEXT],
    updateDocumentOptions: {
      internalVersion: 2,
    },
  });

  const recipient = recipients[0];
  const textField = recipient.fields.find((field) => field.type === FieldType.TEXT);

  if (!textField) {
    throw new Error('Seeded text field not found');
  }

  return { recipient, textField };
};

test('[ENVELOPE_FIELD_SIGN]: rejects field insertion for an expired recipient', async ({ page }) => {
  const { recipient, textField } = await seedV2PendingDocumentWithTextField();

  await prisma.recipient.update({
    where: { id: recipient.id },
    data: {
      // Expired one hour ago.
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  });

  // The seed pre-populates customText with a placeholder value.
  const fieldBefore = await prisma.field.findUniqueOrThrow({ where: { id: textField.id } });

  const response = await callSignEnvelopeField(page, {
    token: recipient.token,
    fieldId: textField.id,
    value: 'TEXT',
  });

  expect(response.ok()).toBeFalsy();

  const fieldAfter = await prisma.field.findUniqueOrThrow({ where: { id: textField.id } });

  expect(fieldAfter.inserted).toBe(false);
  expect(fieldAfter.customText).toBe(fieldBefore.customText);
});

test('[ENVELOPE_FIELD_SIGN]: accepts field insertion for a recipient within their signing window', async ({ page }) => {
  // Positive control: proves the request format reaches the route, so the
  // expired-recipient rejection above cannot pass vacuously.
  const { recipient, textField } = await seedV2PendingDocumentWithTextField();

  await prisma.recipient.update({
    where: { id: recipient.id },
    data: {
      // Expires an hour from now.
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const response = await callSignEnvelopeField(page, {
    token: recipient.token,
    fieldId: textField.id,
    value: 'TEXT',
  });

  expect(response.ok()).toBeTruthy();

  const fieldAfter = await prisma.field.findUniqueOrThrow({ where: { id: textField.id } });

  expect(fieldAfter.inserted).toBe(true);
  expect(fieldAfter.customText).toBe('TEXT');
});
