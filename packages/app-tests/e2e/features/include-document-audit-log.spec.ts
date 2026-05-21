import { getDocumentByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { getEnvelopeItemPdfUrl } from '@documenso/lib/utils/envelope-download';
import { prisma } from '@documenso/prisma';
import { PDF } from '@libpdf/core';
import { expect, type Page, test } from '@playwright/test';
import { DocumentStatus } from '@prisma/client';
import { apiCreateTestContext, apiSeedDraftDocument, apiSeedPendingDocument } from '../fixtures/api-seeds';
import { apiSignin } from '../fixtures/authentication';
import { signSignaturePad } from '../fixtures/signature';

type TeamDocumentSettings = {
  includeAuditLog?: boolean;
  includeSigningCertificate?: boolean;
};

const updateTeamDocumentSettings = async (teamId: number, data: TeamDocumentSettings) => {
  const teamSettings = await prisma.teamGlobalSettings.findFirstOrThrow({
    where: {
      team: {
        id: teamId,
      },
    },
  });

  await prisma.teamGlobalSettings.update({
    where: {
      id: teamSettings.id,
    },
    data,
  });
};

const getFirstEnvelopeItemSignedPageCount = async (envelopeId: string, token: string) => {
  const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({
    where: {
      envelopeId,
    },
  });

  const documentUrl = getEnvelopeItemPdfUrl({
    type: 'download',
    envelopeItem,
    token,
    version: 'signed',
  });

  const response = await fetch(documentUrl);

  expect(response.ok).toBe(true);

  const pdfData = await response.arrayBuffer();
  const pdfDoc = await PDF.load(new Uint8Array(pdfData));

  return pdfDoc.getPageCount();
};

const completeSigning = async ({
  page,
  signingUrl,
  recipientToken,
  fieldId,
}: {
  page: Page;
  signingUrl: string;
  recipientToken: string;
  fieldId: number;
}) => {
  await page.goto(signingUrl);

  await signSignaturePad(page);

  await page.locator(`#field-${fieldId}`).getByRole('button').click();
  await expect(page.locator(`#field-${fieldId}`)).toHaveAttribute('data-inserted', 'true');

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click({ force: true });
  await page.waitForURL(/\/complete$/);

  await expect(async () => {
    const { status } = await getDocumentByToken({
      token: recipientToken,
    });

    expect(status).toBe(DocumentStatus.COMPLETED);
  }).toPass();
};

test.describe('Document audit log embedding', () => {
  test('new documents derive audit-log embedding from team settings', async ({ request }) => {
    const context = await apiCreateTestContext('e2e-audit-log-default');

    await updateTeamDocumentSettings(context.team.id, {
      includeAuditLog: true,
    });

    const { envelope } = await apiSeedDraftDocument(request, {
      context,
    });

    expect(envelope.documentMeta.includeAuditLog).toBe(true);

    await updateTeamDocumentSettings(context.team.id, {
      includeAuditLog: false,
    });

    const documentMeta = await prisma.documentMeta.findFirstOrThrow({
      where: {
        id: envelope.documentMeta.id,
      },
    });

    expect(documentMeta.includeAuditLog).toBe(true);
  });

  test('meta.includeAuditLog true appends audit-log pages when team default is false', async ({ page, request }) => {
    const context = await apiCreateTestContext('e2e-audit-log-override-true');

    await updateTeamDocumentSettings(context.team.id, {
      includeAuditLog: false,
      includeSigningCertificate: false,
    });

    const { distributeResult, envelope } = await apiSeedPendingDocument(request, {
      context,
      meta: {
        includeAuditLog: true,
      },
    });

    expect(envelope.documentMeta.includeAuditLog).toBe(true);

    const signer = distributeResult.recipients[0];
    const signatureField = envelope.fields.find((field) => field.recipientId === signer.id);

    if (!signatureField) {
      throw new Error('Signature field not found');
    }

    const baselinePageCount = await getFirstEnvelopeItemSignedPageCount(envelope.id, signer.token);

    await completeSigning({
      page,
      signingUrl: signer.signingUrl,
      recipientToken: signer.token,
      fieldId: signatureField.id,
    });

    await expect(async () => {
      const signedPageCount = await getFirstEnvelopeItemSignedPageCount(envelope.id, signer.token);

      expect(signedPageCount).toBe(baselinePageCount + 1);
    }).toPass();
  });

  test('meta.includeAuditLog false skips embedded audit logs when team default is true', async ({ page, request }) => {
    const context = await apiCreateTestContext('e2e-audit-log-override-false');

    await updateTeamDocumentSettings(context.team.id, {
      includeAuditLog: true,
      includeSigningCertificate: false,
    });

    const { distributeResult, envelope, team, user } = await apiSeedPendingDocument(request, {
      context,
      meta: {
        includeAuditLog: false,
      },
    });

    expect(envelope.documentMeta.includeAuditLog).toBe(false);

    const signer = distributeResult.recipients[0];
    const signatureField = envelope.fields.find((field) => field.recipientId === signer.id);

    if (!signatureField) {
      throw new Error('Signature field not found');
    }

    const baselinePageCount = await getFirstEnvelopeItemSignedPageCount(envelope.id, signer.token);

    await completeSigning({
      page,
      signingUrl: signer.signingUrl,
      recipientToken: signer.token,
      fieldId: signatureField.id,
    });

    await expect(async () => {
      const signedPageCount = await getFirstEnvelopeItemSignedPageCount(envelope.id, signer.token);

      expect(signedPageCount).toBe(baselinePageCount);
    }).toPass();

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents/${envelope.id}/logs`,
    });

    const downloadPromise = page.waitForEvent('download');

    await page.getByRole('button', { name: 'Download Audit Logs' }).click();

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('Audit Logs.pdf');
  });
});
