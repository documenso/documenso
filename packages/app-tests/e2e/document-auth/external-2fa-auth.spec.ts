import { expect, test } from '@playwright/test';
import { FieldType } from '@prisma/client';

import { issueSigningTwoFactorToken } from '@documenso/lib/server-only/signing-2fa/issue-signing-two-factor-token';
import {
  createDocumentAuthOptions,
  createRecipientAuthOptions,
} from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';

import { signSignaturePad } from '../fixtures/signature';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

const seedExternal2FADocument = async (recipientEmail?: string) => {
  const { user: owner, team } = await seedUser();

  const recipientArg = recipientEmail ?? seedTestEmail();

  const { recipients, document } = await seedPendingDocumentWithFullFields({
    owner,
    teamId: team.id,
    recipients: [recipientArg],
    recipientsCreateOptions: [
      {
        authOptions: createRecipientAuthOptions({
          accessAuth: [],
          actionAuth: ['EXTERNAL_TWO_FACTOR_AUTH'],
        }),
      },
    ],
    fields: [FieldType.SIGNATURE],
  });

  const apiToken = await prisma.apiToken.create({
    data: {
      name: 'test-2fa-token',
      token: `test-${Date.now()}-${Math.random()}`,
      teamId: team.id,
      userId: owner.id,
    },
  });

  return { owner, team, document, recipient: recipients[0], apiToken };
};

test('[EXTERNAL_2FA]: should allow signing when valid code is entered', async ({ page }) => {
  const { document, recipient, apiToken } = await seedExternal2FADocument();

  const { token: plaintextCode } = await issueSigningTwoFactorToken({
    envelopeId: document.id,
    recipientId: recipient.id,
    apiTokenId: apiToken.id,
  });

  const signUrl = `/sign/${recipient.token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  const signatureField = recipient.fields.find((f) => f.type === FieldType.SIGNATURE);

  if (!signatureField) {
    throw new Error('No signature field found');
  }

  await page.locator(`#field-${signatureField.id}`).getByRole('button').click();

  await expect(page.getByText('Verification code')).toBeVisible();

  const pinInputs = page.locator('input[data-input-otp-placeholder]');
  await pinInputs.first().click();

  for (const digit of plaintextCode.split('')) {
    await page.keyboard.type(digit);
  }

  await page.getByRole('button', { name: 'Verify' }).click();

  await expect(page.locator(`#field-${signatureField.id}`)).toHaveAttribute(
    'data-inserted',
    'true',
    { timeout: 10000 },
  );

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(`${signUrl}/complete`);
});

test('[EXTERNAL_2FA]: should deny signing field when no token has been issued', async ({
  page,
}) => {
  const { recipient } = await seedExternal2FADocument();

  const signUrl = `/sign/${recipient.token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  const signatureField = recipient.fields.find((f) => f.type === FieldType.SIGNATURE);

  if (!signatureField) {
    throw new Error('No signature field found');
  }

  await page.locator(`#field-${signatureField.id}`).getByRole('button').click();

  await expect(page.getByText('Verification code required')).toBeVisible();
  await expect(page.getByText('Please contact the document sender')).toBeVisible();
});

test('[EXTERNAL_2FA]: should show error when invalid code is entered', async ({ page }) => {
  const { document, recipient, apiToken } = await seedExternal2FADocument();

  await issueSigningTwoFactorToken({
    envelopeId: document.id,
    recipientId: recipient.id,
    apiTokenId: apiToken.id,
  });

  const signUrl = `/sign/${recipient.token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  const signatureField = recipient.fields.find((f) => f.type === FieldType.SIGNATURE);

  if (!signatureField) {
    throw new Error('No signature field found');
  }

  await page.locator(`#field-${signatureField.id}`).getByRole('button').click();

  await expect(page.getByText('Verification code')).toBeVisible();

  const pinInputs = page.locator('input[data-input-otp-placeholder]');
  await pinInputs.first().click();

  for (const digit of '000000'.split('')) {
    await page.keyboard.type(digit);
  }

  await page.getByRole('button', { name: 'Verify' }).click();

  await expect(page.getByText('Verification failed')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Invalid code')).toBeVisible();
});

test('[EXTERNAL_2FA]: should show expired error when token has expired', async ({ page }) => {
  const { document, recipient, apiToken } = await seedExternal2FADocument();

  await issueSigningTwoFactorToken({
    envelopeId: document.id,
    recipientId: recipient.id,
    apiTokenId: apiToken.id,
  });

  await prisma.signingTwoFactorToken.updateMany({
    where: {
      recipientId: recipient.id,
      envelopeId: document.id,
      status: 'ACTIVE',
    },
    data: {
      expiresAt: new Date(Date.now() - 60_000),
    },
  });

  const signUrl = `/sign/${recipient.token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  const signatureField = recipient.fields.find((f) => f.type === FieldType.SIGNATURE);

  if (!signatureField) {
    throw new Error('No signature field found');
  }

  await page.locator(`#field-${signatureField.id}`).getByRole('button').click();

  await expect(page.getByText('Verification code')).toBeVisible();

  const pinInputs = page.locator('input[data-input-otp-placeholder]');
  await pinInputs.first().click();

  for (const digit of '123456'.split('')) {
    await page.keyboard.type(digit);
  }

  await page.getByRole('button', { name: 'Verify' }).click();

  await expect(page.getByText('Verification failed')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('code has expired')).toBeVisible();
});

test('[EXTERNAL_2FA]: should allow signing with global action auth on document', async ({
  page,
}) => {
  const { user: owner, team } = await seedUser();

  const { recipients, document } = await seedPendingDocumentWithFullFields({
    owner,
    teamId: team.id,
    recipients: [seedTestEmail()],
    recipientsCreateOptions: [
      {
        authOptions: createRecipientAuthOptions({
          accessAuth: [],
          actionAuth: [],
        }),
      },
    ],
    updateDocumentOptions: {
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: [],
        globalActionAuth: ['EXTERNAL_TWO_FACTOR_AUTH'],
      }),
    },
    fields: [FieldType.SIGNATURE],
  });

  const recipient = recipients[0];

  const apiToken = await prisma.apiToken.create({
    data: {
      name: 'test-2fa-global',
      token: `test-global-${Date.now()}-${Math.random()}`,
      teamId: team.id,
      userId: owner.id,
    },
  });

  const { token: plaintextCode } = await issueSigningTwoFactorToken({
    envelopeId: document.id,
    recipientId: recipient.id,
    apiTokenId: apiToken.id,
  });

  const signUrl = `/sign/${recipient.token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  const signatureField = recipient.fields.find((f) => f.type === FieldType.SIGNATURE);

  if (!signatureField) {
    throw new Error('No signature field found');
  }

  await page.locator(`#field-${signatureField.id}`).getByRole('button').click();

  await expect(page.getByText('Verification code')).toBeVisible();

  const pinInputs = page.locator('input[data-input-otp-placeholder]');
  await pinInputs.first().click();

  for (const digit of plaintextCode.split('')) {
    await page.keyboard.type(digit);
  }

  await page.getByRole('button', { name: 'Verify' }).click();

  await expect(page.locator(`#field-${signatureField.id}`)).toHaveAttribute(
    'data-inserted',
    'true',
    { timeout: 10000 },
  );

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(`${signUrl}/complete`);
});

test('[EXTERNAL_2FA]: should revoke old token when a new one is issued', async ({ page }) => {
  const { document, recipient, apiToken } = await seedExternal2FADocument();

  await issueSigningTwoFactorToken({
    envelopeId: document.id,
    recipientId: recipient.id,
    apiTokenId: apiToken.id,
  });

  const { token: newCode } = await issueSigningTwoFactorToken({
    envelopeId: document.id,
    recipientId: recipient.id,
    apiTokenId: apiToken.id,
  });

  const revokedTokens = await prisma.signingTwoFactorToken.findMany({
    where: {
      recipientId: recipient.id,
      envelopeId: document.id,
      status: 'REVOKED',
    },
  });

  expect(revokedTokens.length).toBe(1);

  const signUrl = `/sign/${recipient.token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  const signatureField = recipient.fields.find((f) => f.type === FieldType.SIGNATURE);

  if (!signatureField) {
    throw new Error('No signature field found');
  }

  await page.locator(`#field-${signatureField.id}`).getByRole('button').click();

  await expect(page.getByText('Verification code')).toBeVisible();

  const pinInputs = page.locator('input[data-input-otp-placeholder]');
  await pinInputs.first().click();

  for (const digit of newCode.split('')) {
    await page.keyboard.type(digit);
  }

  await page.getByRole('button', { name: 'Verify' }).click();

  await expect(page.locator(`#field-${signatureField.id}`)).toHaveAttribute(
    'data-inserted',
    'true',
    { timeout: 10000 },
  );
});
