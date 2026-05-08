import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { PDF } from '@libpdf/core';
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DocumentStatus, FieldType, SigningStatus } from '@prisma/client';

import { apiSeedDraftDocument, apiSeedPendingDocument } from '../../fixtures/api-seeds';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const API_BASE_URL = `${WEBAPP_BASE_URL}/api/v2-beta`;

const trpcMutation = async (request: APIRequestContext, procedure: string, input: Record<string, unknown>) => {
  const res = await request.post(`${WEBAPP_BASE_URL}/api/trpc/${procedure}`, {
    headers: {
      'content-type': 'application/json',
    },
    data: JSON.stringify({ json: input }),
  });

  expect(res.ok(), `${procedure} failed: ${await res.text()}`).toBeTruthy();
};

const getPdfBytes = async (response: Awaited<ReturnType<APIRequestContext['get']>>) => {
  const body = await response.body();

  expect(body.subarray(0, 5).toString()).toBe('%PDF-');

  return new Uint8Array(body);
};

const signAndCompleteRecipient = async ({
  request,
  token,
  documentId,
  fieldId,
}: {
  request: APIRequestContext;
  token: string;
  documentId: number;
  fieldId: number;
}) => {
  await trpcMutation(request, 'envelope.field.sign', {
    token,
    fieldId,
    fieldValue: {
      type: FieldType.SIGNATURE,
      value: 'Signature',
    },
  });

  await trpcMutation(request, 'recipient.completeDocumentWithToken', {
    token,
    documentId,
  });
};

test.describe('API V2 partial signed PDF downloads', () => {
  test('returns a PDF with inserted fields, supports ETag, and rejects after completion', async ({ request }) => {
    const { envelope, token, distributeResult } = await apiSeedPendingDocument(request, {
      recipients: [
        { email: 'partial-signer-1@test.documenso.com', name: 'Partial Signer 1' },
        { email: 'partial-signer-2@test.documenso.com', name: 'Partial Signer 2' },
      ],
      fieldsPerRecipient: [
        [{ type: FieldType.SIGNATURE, page: 1, positionX: 5, positionY: 5, width: 15, height: 5 }],
        [
          {
            type: FieldType.SIGNATURE,
            page: 1,
            positionX: 5,
            positionY: 15,
            width: 15,
            height: 5,
          },
        ],
      ],
    });

    const [recipientOne, recipientTwo] = distributeResult.recipients;
    const documentId = mapSecondaryIdToDocumentId(envelope.secondaryId);
    const envelopeItem = envelope.envelopeItems[0];
    const recipientOneField = envelope.fields.find(
      (field) => field.recipientId === recipientOne.id && field.type === FieldType.SIGNATURE,
    );
    const recipientTwoField = envelope.fields.find(
      (field) => field.recipientId === recipientTwo.id && field.type === FieldType.SIGNATURE,
    );

    if (!recipientOneField || !recipientTwoField) {
      throw new Error('Expected signature fields not found');
    }

    await signAndCompleteRecipient({
      request,
      token: recipientOne.token,
      documentId,
      fieldId: recipientOneField.id,
    });

    await expect(async () => {
      const dbEnvelope = await prisma.envelope.findUniqueOrThrow({
        where: {
          id: envelope.id,
        },
        include: {
          recipients: true,
        },
      });

      expect(dbEnvelope.status).toBe(DocumentStatus.PENDING);
      expect(dbEnvelope.recipients.find((recipient) => recipient.id === recipientOne.id)?.signingStatus).toBe(
        SigningStatus.SIGNED,
      );
    }).toPass();

    const downloadUrl = `${API_BASE_URL}/envelope/item/${envelopeItem.id}/download?version=pending`;
    const pendingResponse = await request.get(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(pendingResponse.status()).toBe(200);
    expect(pendingResponse.headers()['content-type']).toContain('application/pdf');
    expect(pendingResponse.headers()['cache-control']).toBe('no-store, private');
    expect(pendingResponse.headers()['content-disposition']).toContain('_pending.pdf');

    const etag = pendingResponse.headers().etag;
    expect(etag).toBeTruthy();

    const pendingPdfBytes = await getPdfBytes(pendingResponse);
    const pendingPdf = await PDF.load(pendingPdfBytes);

    const originalEnvelopeItem = await prisma.envelopeItem.findUniqueOrThrow({
      where: {
        id: envelopeItem.id,
      },
      include: {
        documentData: true,
      },
    });
    const originalPdfBytes = await getFileServerSide({
      type: originalEnvelopeItem.documentData.type,
      data: originalEnvelopeItem.documentData.initialData,
    });
    const originalPdf = await PDF.load(new Uint8Array(originalPdfBytes));

    // Pending PDF should have the same page count as the original (no cert/audit pages).
    expect(pendingPdf.getPageCount()).toBe(originalPdf.getPageCount());

    const cachedResponse = await request.get(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'If-None-Match': etag,
      },
    });

    expect(cachedResponse.status()).toBe(304);

    await signAndCompleteRecipient({
      request,
      token: recipientTwo.token,
      documentId,
      fieldId: recipientTwoField.id,
    });

    await expect(async () => {
      const dbEnvelope = await prisma.envelope.findUniqueOrThrow({
        where: {
          id: envelope.id,
        },
      });

      expect(dbEnvelope.status).toBe(DocumentStatus.COMPLETED);
    }).toPass({ timeout: 15_000 });

    const completedResponse = await request.get(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const completedError = await completedResponse.json();

    expect(completedResponse.status()).toBe(400);
    expect(completedError.code).toBe('ENVELOPE_COMPLETED');

    const signedResponse = await request.get(
      `${API_BASE_URL}/envelope/item/${envelopeItem.id}/download?version=signed`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(signedResponse.status()).toBe(200);
    await getPdfBytes(signedResponse);
  });

  test('rejects draft and legacy pending envelopes', async ({ request }) => {
    const draft = await apiSeedDraftDocument(request, {
      recipients: [{ email: 'partial-draft@test.documenso.com', name: 'Draft Signer' }],
    });
    const draftResponse = await request.get(
      `${API_BASE_URL}/envelope/item/${draft.envelope.envelopeItems[0].id}/download?version=pending`,
      {
        headers: {
          Authorization: `Bearer ${draft.token}`,
        },
      },
    );
    const draftError = await draftResponse.json();

    expect(draftResponse.status()).toBe(400);
    expect(draftError.code).toBe('ENVELOPE_DRAFT');

    const legacy = await apiSeedPendingDocument(request);

    await prisma.envelope.update({
      where: {
        id: legacy.envelope.id,
      },
      data: {
        internalVersion: 1,
      },
    });

    const legacyResponse = await request.get(
      `${API_BASE_URL}/envelope/item/${legacy.envelope.envelopeItems[0].id}/download?version=pending`,
      {
        headers: {
          Authorization: `Bearer ${legacy.token}`,
        },
      },
    );
    const legacyError = await legacyResponse.json();

    expect(legacyResponse.status()).toBe(400);
    expect(legacyError.code).toBe('ENVELOPE_LEGACY');
  });
});
