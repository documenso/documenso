import { setTimeout as sleep } from 'node:timers/promises';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { generateExternal2FACode } from '@documenso/lib/server-only/2fa/external-2fa-code';
import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import type { TRecipientAccessAuthTypes } from '@documenso/lib/types/document-auth';
import { createRecipientAuthOptions } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { FieldType, SigningStatus } from '@prisma/client';

import { signSignaturePad } from '../fixtures/signature';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

const baseUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2`;

const seedDocument = async (accessAuth: TRecipientAccessAuthTypes[]) => {
  const { user: owner, team } = await seedUser();

  const { document, recipients } = await seedPendingDocumentWithFullFields({
    owner,
    teamId: team.id,
    recipients: [seedTestEmail()],
    recipientsCreateOptions: [{ authOptions: createRecipientAuthOptions({ accessAuth, actionAuth: [] }) }],
    fields: [FieldType.SIGNATURE],
  });

  const { token } = await createApiToken({ userId: owner.id, teamId: team.id, tokenName: 'owner', expiresIn: null });

  return { envelopeId: document.id, recipient: recipients[0], apiToken: token };
};

const request2FACode = async (
  request: APIRequestContext,
  { apiToken, envelopeId, recipientId }: { apiToken: string; envelopeId: string; recipientId: number },
) =>
  await request.post(`${baseUrl}/envelope/recipient/${recipientId}/2fa-code`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: { envelopeId },
  });

test('[DOCUMENT_AUTH]: recipient completes the document with the external 2FA code from the API', async ({
  page,
  request,
}) => {
  const { envelopeId, recipient, apiToken } = await seedDocument(['EXTERNAL_TWO_FACTOR_AUTH']);

  const res = await request2FACode(request, { apiToken, envelopeId, recipientId: recipient.id });
  expect(res.status()).toBe(200);

  const { code } = await res.json();
  expect(code).toMatch(/^\d{6}$/);

  const signUrl = `/sign/${recipient.token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  for (const field of recipient.fields) {
    await page.locator(`#field-${field.id}`).getByRole('button').click();
    await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
  }

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();

  const dialog = page.getByRole('dialog');

  // External-only recipients go straight to the code input; no email is offered or sent.
  await expect(dialog.getByText('Enter the 6-digit code that the sender of this document sent to you.')).toBeVisible();
  await expect(dialog.getByText('Email verification')).not.toBeVisible();

  await dialog.getByLabel('2FA code').fill(code === '000000' ? '111111' : '000000');
  await dialog.getByRole('button', { name: 'Verify & Complete' }).click();
  await expect(dialog.getByText('Invalid verification code. Please try again.')).toBeVisible();

  await dialog.getByLabel('2FA code').fill(code);
  await dialog.getByRole('button', { name: 'Verify & Complete' }).click();
  await page.waitForURL(`${signUrl}/complete`);

  const updatedRecipient = await prisma.recipient.findUniqueOrThrow({ where: { id: recipient.id } });
  expect(updatedRecipient.signingStatus).toBe(SigningStatus.SIGNED);
});

test('[DOCUMENT_AUTH]: API token from another team cannot get an external 2FA code', async ({ request }) => {
  const { envelopeId, recipient } = await seedDocument(['EXTERNAL_TWO_FACTOR_AUTH']);
  const { apiToken: otherTeamToken } = await seedDocument(['EXTERNAL_TWO_FACTOR_AUTH']);

  const res = await request2FACode(request, { apiToken: otherTeamToken, envelopeId, recipientId: recipient.id });

  expect(res.status()).toBe(404);
});

test('[DOCUMENT_AUTH]: API refuses an external 2FA code for a recipient without external 2FA', async ({ request }) => {
  const { envelopeId, recipient, apiToken } = await seedDocument(['TWO_FACTOR_AUTH']);

  const res = await request2FACode(request, { apiToken, envelopeId, recipientId: recipient.id });

  expect(res.status()).toBe(400);
});

test('[DOCUMENT_AUTH]: recipient cannot try more than 5 2FA codes in 15 minutes', async () => {
  test.skip(process.env.DANGEROUS_BYPASS_RATE_LIMITS === 'true', 'Rate limits are bypassed');
  test.setTimeout(120_000);

  const { envelopeId, recipient } = await seedDocument(['EXTERNAL_TWO_FACTOR_AUTH']);
  const { code } = await generateExternal2FACode({ envelopeId, recipientId: recipient.id });
  const wrongCode = code === '000000' ? '111111' : '000000';

  // The limit counts in fixed 15-minute buckets. When a reset is close, wait for it so that all attempts share one bucket.
  const windowMs = 15 * 60_000;
  const msToNextBucket = windowMs - (Date.now() % windowMs);

  if (msToNextBucket < 60_000) {
    await sleep(msToNextBucket + 100);
  }

  const complete = async (token: string) =>
    await completeDocumentWithToken({
      token: recipient.token,
      id: { type: 'envelopeId', id: envelopeId },
      accessAuthOptions: { type: 'EXTERNAL_TWO_FACTOR_AUTH', token },
      // A unique address keeps the shared per-IP limit out of this test.
      requestMetadata: { ipAddress: `external-2fa-e2e-${recipient.id}` },
    }).then(
      () => 'COMPLETED',
      (error) => AppError.parseError(error).code,
    );

  for (let attempt = 1; attempt <= 5; attempt++) {
    expect(await complete(wrongCode)).toBe(AppErrorCode.TWO_FACTOR_AUTH_FAILED);
  }

  expect(await complete(code)).toBe(AppErrorCode.TOO_MANY_REQUESTS);

  const updatedRecipient = await prisma.recipient.findUniqueOrThrow({ where: { id: recipient.id } });
  expect(updatedRecipient.signingStatus).toBe(SigningStatus.NOT_SIGNED);
});
