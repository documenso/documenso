import { setTimeout as sleep } from 'node:timers/promises';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppErrorCode } from '@documenso/lib/errors/app-error';
import { generateTwoFactorTokenFromEmail } from '@documenso/lib/server-only/2fa/email/generate-2fa-token-from-email';
import { generateExternal2FACode } from '@documenso/lib/server-only/2fa/external-2fa-code';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import type { TRecipientAccessAuth, TRecipientAccessAuthTypes } from '@documenso/lib/types/document-auth';
import { createRecipientAuthOptions } from '@documenso/lib/utils/document-auth';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { seedPendingDocument, seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DocumentVisibility, FieldType, type Recipient, SigningStatus, TeamMemberRole } from '@prisma/client';

import { apiSignin, WEBAPP_ORIGIN_HEADERS } from '../fixtures/authentication';
import { signSignaturePad } from '../fixtures/signature';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

const EXTERNAL: TRecipientAccessAuthTypes[] = ['EXTERNAL_TWO_FACTOR_AUTH'];

/**
 * Seeds a pending document with one recipient for each access auth list.
 *
 * Without fields, a recipient can complete through the API alone.
 */
const seedDocument = async (accessAuths: TRecipientAccessAuthTypes[][], fields: FieldType[] = []) => {
  const { user: owner, team } = await seedUser();

  const { document, recipients } = await seedPendingDocumentWithFullFields({
    owner,
    teamId: team.id,
    recipients: accessAuths.map(() => seedTestEmail()),
    recipientsCreateOptions: accessAuths.map((accessAuth) => ({
      authOptions: createRecipientAuthOptions({ accessAuth, actionAuth: [] }),
    })),
    fields,
  });

  const { token } = await createApiToken({ userId: owner.id, teamId: team.id, tokenName: 'owner', expiresIn: null });

  return {
    owner,
    team,
    apiToken: token,
    envelopeId: document.id,
    documentId: mapSecondaryIdToDocumentId(document.secondaryId),
    recipients: recipients.sort((a, b) => a.id - b.id),
  };
};

const request2FACode = async (
  request: APIRequestContext,
  { apiToken, envelopeId, recipientId }: { apiToken?: string; envelopeId: string; recipientId: number },
) =>
  await request.post(`${WEBAPP_BASE_URL}/api/v2/envelope/recipient/${recipientId}/2fa-code`, {
    headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
    data: { envelopeId },
  });

/**
 * Completes the document through the route that the signing page calls.
 *
 * Returns the completion status, or the error code when the server refuses.
 */
const completeDocument = async (
  request: APIRequestContext,
  {
    documentId,
    recipient,
    accessAuthOptions,
  }: { documentId: number; recipient: Pick<Recipient, 'id' | 'token'>; accessAuthOptions?: TRecipientAccessAuth },
): Promise<string> => {
  const res = await request.post(`${WEBAPP_BASE_URL}/api/trpc/recipient.completeDocumentWithToken`, {
    headers: {
      ...WEBAPP_ORIGIN_HEADERS,
      'content-type': 'application/json',
      // The 2FA attempt limit also counts per IP. An address for each recipient keeps
      // parallel tests and repeated local runs out of one shared budget.
      'x-forwarded-for': `10.${(recipient.id >> 16) & 255}.${(recipient.id >> 8) & 255}.${recipient.id & 255}`,
    },
    data: JSON.stringify({ json: { token: recipient.token, documentId, accessAuthOptions } }),
  });

  const body = await res.json();

  return res.ok() ? body.result.data.json.status : body.error.json.data.code;
};

const find2FAAuditLogs = async (envelopeId: string) => {
  const auditLogs = await prisma.documentAuditLog.findMany({
    where: { envelopeId, type: { startsWith: 'DOCUMENT_ACCESS_AUTH_2FA_' } },
    orderBy: { createdAt: 'asc' },
  });

  return auditLogs.map((auditLog) => {
    const { recipientId, isExternal } = auditLog.data as Record<string, unknown>;

    return { type: auditLog.type, recipientId, isExternal };
  });
};

const openTwoFactorStep = async (page: Page, recipient: Pick<Recipient, 'token'> & { fields: { id: number }[] }) => {
  await page.goto(`/sign/${recipient.token}`);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  for (const field of recipient.fields) {
    await page.locator(`#field-${field.id}`).getByRole('button').click();
    await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
  }

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();

  return page.getByRole('dialog');
};

test('[DOCUMENT_AUTH]: recipient completes the document with the external 2FA code from the API', async ({
  page,
  request,
}) => {
  const {
    envelopeId,
    recipients: [recipient],
    apiToken,
  } = await seedDocument([EXTERNAL], [FieldType.SIGNATURE]);

  const res = await request2FACode(request, { apiToken, envelopeId, recipientId: recipient.id });
  expect(res.status()).toBe(200);

  const { code } = await res.json();
  expect(code).toMatch(/^\d{6}$/);

  const dialog = await openTwoFactorStep(page, recipient);

  // External-only recipients go straight to the code input; no email is offered or sent.
  await expect(dialog.getByText('Enter the 6-digit code that the sender of this document sent to you.')).toBeVisible();
  await expect(dialog.getByText('Email verification')).not.toBeVisible();

  await dialog.getByLabel('2FA code').fill(code === '000000' ? '111111' : '000000');
  await dialog.getByRole('button', { name: 'Verify & Complete' }).click();
  await expect(dialog.getByText('Invalid verification code. Please try again.')).toBeVisible();

  await dialog.getByLabel('2FA code').fill(code);
  await dialog.getByRole('button', { name: 'Verify & Complete' }).click();
  await page.waitForURL(`/sign/${recipient.token}/complete`);

  const updatedRecipient = await prisma.recipient.findUniqueOrThrow({ where: { id: recipient.id } });
  expect(updatedRecipient.signingStatus).toBe(SigningStatus.SIGNED);

  expect(await find2FAAuditLogs(envelopeId)).toEqual([
    { type: 'DOCUMENT_ACCESS_AUTH_2FA_REQUESTED', recipientId: recipient.id, isExternal: true },
    { type: 'DOCUMENT_ACCESS_AUTH_2FA_FAILED', recipientId: recipient.id, isExternal: true },
    { type: 'DOCUMENT_ACCESS_AUTH_2FA_VALIDATED', recipientId: recipient.id, isExternal: true },
  ]);
});

test('[DOCUMENT_AUTH]: recipient with email and external 2FA can choose the code from the sender', async ({ page }) => {
  const {
    envelopeId,
    recipients: [recipient],
  } = await seedDocument([['TWO_FACTOR_AUTH', 'EXTERNAL_TWO_FACTOR_AUTH']], [FieldType.SIGNATURE]);

  const { code } = await generateExternal2FACode({ envelopeId, recipientId: recipient.id });

  const dialog = await openTwoFactorStep(page, recipient);

  await expect(dialog.getByRole('heading', { name: 'Choose verification method' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Email verification/ })).toBeVisible();

  await dialog.getByRole('button', { name: /Code from the sender/ }).click();
  await dialog.getByLabel('2FA code').fill(code);
  await dialog.getByRole('button', { name: 'Verify & Complete' }).click();
  await page.waitForURL(`/sign/${recipient.token}/complete`);

  expect(await find2FAAuditLogs(envelopeId)).toEqual([
    { type: 'DOCUMENT_ACCESS_AUTH_2FA_VALIDATED', recipientId: recipient.id, isExternal: true },
  ]);
});

test('[DOCUMENT_AUTH]: completion refuses each code that is not the current external 2FA code of the recipient', async ({
  request,
}) => {
  const {
    envelopeId,
    documentId,
    recipients: [target, peer, emailOnly],
  } = await seedDocument([EXTERNAL, EXTERNAL, ['TWO_FACTOR_AUTH']]);

  const otherDocument = await seedDocument([EXTERNAL]);

  const external = async (recipientId: number, id = envelopeId, now?: number): Promise<TRecipientAccessAuth> => {
    const { code } = await generateExternal2FACode({ envelopeId: id, recipientId }, now);

    return { type: 'EXTERNAL_TWO_FACTOR_AUTH', token: code };
  };

  const peerCode = await external(peer.id);

  expect(await completeDocument(request, { documentId, recipient: peer, accessAuthOptions: peerCode })).toBe('SIGNED');

  expect(await completeDocument(request, { documentId, recipient: target })).toBe(AppErrorCode.UNAUTHORIZED);

  const invalidCodes = [
    {
      name: 'code of another recipient of the envelope',
      recipient: target,
      accessAuthOptions: peerCode,
      isExternal: true,
    },
    {
      name: 'code of a recipient of another envelope',
      recipient: target,
      accessAuthOptions: await external(otherDocument.recipients[0].id, otherDocument.envelopeId),
      isExternal: true,
    },
    {
      name: 'code that expired',
      recipient: target,
      accessAuthOptions: await external(target.id, envelopeId, Date.now() - 10 * 60_000),
      isExternal: true,
    },
    {
      name: 'email code for a recipient with only external 2FA',
      recipient: target,
      accessAuthOptions: {
        type: 'TWO_FACTOR_AUTH',
        method: 'email',
        token: await generateTwoFactorTokenFromEmail({ envelopeId, email: target.email }),
      },
      isExternal: false,
    },
    {
      name: 'external code for a recipient with only internal 2FA',
      recipient: emailOnly,
      accessAuthOptions: await external(emailOnly.id),
      isExternal: true,
    },
  ] satisfies { name: string; recipient: Recipient; accessAuthOptions: TRecipientAccessAuth; isExternal: boolean }[];

  for (const { name, recipient, accessAuthOptions } of invalidCodes) {
    expect(await completeDocument(request, { documentId, recipient, accessAuthOptions }), name).toBe(
      AppErrorCode.TWO_FACTOR_AUTH_FAILED,
    );
  }

  const signedRecipients = await prisma.recipient.findMany({
    where: { envelopeId, signingStatus: SigningStatus.SIGNED },
  });

  expect(signedRecipients.map((recipient) => recipient.id)).toEqual([peer.id]);

  expect(await find2FAAuditLogs(envelopeId)).toEqual([
    { type: 'DOCUMENT_ACCESS_AUTH_2FA_VALIDATED', recipientId: peer.id, isExternal: true },
    ...invalidCodes.map(({ recipient, isExternal }) => ({
      type: 'DOCUMENT_ACCESS_AUTH_2FA_FAILED',
      recipientId: recipient.id,
      isExternal,
    })),
  ]);
});

test('[DOCUMENT_AUTH]: a signed-in recipient cannot use account auth in place of the external 2FA code', async ({
  page,
}) => {
  const {
    envelopeId,
    documentId,
    recipients: [recipient],
  } = await seedDocument([['ACCOUNT', 'EXTERNAL_TWO_FACTOR_AUTH']]);

  const { user: recipientUser } = await seedUser();

  await prisma.recipient.update({ where: { id: recipient.id }, data: { email: recipientUser.email } });
  await apiSignin({ page, email: recipientUser.email });

  const { request } = page.context();

  expect(await completeDocument(request, { documentId, recipient, accessAuthOptions: { type: 'ACCOUNT' } })).toBe(
    AppErrorCode.TWO_FACTOR_AUTH_FAILED,
  );

  const { code } = await generateExternal2FACode({ envelopeId, recipientId: recipient.id });

  expect(
    await completeDocument(request, {
      documentId,
      recipient,
      accessAuthOptions: { type: 'EXTERNAL_TWO_FACTOR_AUTH', token: code },
    }),
  ).toBe('SIGNED');
});

test('[DOCUMENT_AUTH]: API gives an external 2FA code only to a caller that can access the recipient', async ({
  request,
}) => {
  const {
    owner,
    team,
    envelopeId,
    recipients: [recipient],
    apiToken,
  } = await seedDocument([EXTERNAL]);

  const otherTeam = await seedDocument([EXTERNAL]);
  const otherEnvelope = await seedPendingDocument(owner, team.id, [seedTestEmail()]);

  await prisma.envelope.update({ where: { id: envelopeId }, data: { visibility: DocumentVisibility.ADMIN } });

  const manager = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });

  const { token: managerToken } = await createApiToken({
    userId: manager.id,
    teamId: team.id,
    tokenName: 'manager',
    expiresIn: null,
  });

  const allowed = await request2FACode(request, { apiToken, envelopeId, recipientId: recipient.id });
  expect(allowed.status()).toBe(200);

  const deniedCallers = [
    { name: 'no API token', envelopeId, status: 401 },
    { name: 'API token of another team', apiToken: otherTeam.apiToken, envelopeId, status: 404 },
    { name: 'manager on a document that only admins can see', apiToken: managerToken, envelopeId, status: 404 },
    { name: 'owner with the ID of another envelope', apiToken, envelopeId: otherEnvelope.id, status: 404 },
  ];

  for (const { name, status, ...caller } of deniedCallers) {
    const res = await request2FACode(request, { ...caller, recipientId: recipient.id });

    expect(res.status(), name).toBe(status);
  }

  expect(await find2FAAuditLogs(envelopeId)).toEqual([
    { type: 'DOCUMENT_ACCESS_AUTH_2FA_REQUESTED', recipientId: recipient.id, isExternal: true },
  ]);
});

test('[DOCUMENT_AUTH]: API refuses an external 2FA code for a recipient without external 2FA', async ({ request }) => {
  const {
    envelopeId,
    recipients: [recipient],
    apiToken,
  } = await seedDocument([['TWO_FACTOR_AUTH']]);

  const res = await request2FACode(request, { apiToken, envelopeId, recipientId: recipient.id });

  expect(res.status()).toBe(400);
});

test('[DOCUMENT_AUTH]: recipient cannot try more than 5 2FA codes in 15 minutes', async ({ request }) => {
  test.skip(process.env.DANGEROUS_BYPASS_RATE_LIMITS === 'true', 'Rate limits are bypassed');
  test.setTimeout(120_000);

  const {
    envelopeId,
    documentId,
    recipients: [recipient],
  } = await seedDocument([EXTERNAL]);

  const { code } = await generateExternal2FACode({ envelopeId, recipientId: recipient.id });
  const wrongCode = code === '000000' ? '111111' : '000000';

  // The limit counts in fixed 15-minute buckets. When a reset is close, wait for it so that all attempts share one bucket.
  const windowMs = 15 * 60_000;
  const msToNextBucket = windowMs - (Date.now() % windowMs);

  if (msToNextBucket < 60_000) {
    await sleep(msToNextBucket + 100);
  }

  const complete = async (token: string) =>
    await completeDocument(request, {
      documentId,
      recipient,
      accessAuthOptions: { type: 'EXTERNAL_TWO_FACTOR_AUTH', token },
    });

  for (let attempt = 1; attempt <= 5; attempt++) {
    expect(await complete(wrongCode)).toBe(AppErrorCode.TWO_FACTOR_AUTH_FAILED);
  }

  expect(await complete(code)).toBe(AppErrorCode.TOO_MANY_REQUESTS);

  const updatedRecipient = await prisma.recipient.findUniqueOrThrow({ where: { id: recipient.id } });
  expect(updatedRecipient.signingStatus).toBe(SigningStatus.NOT_SIGNED);
});
