import { DocumentStatus, EnvelopeType, RecipientRole, SigningStatus } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lingui/core/macro', () => ({
  msg: (strings: TemplateStringsArray, ...values: unknown[]) => {
    const message = String.raw({ raw: strings }, ...values);

    return {
      id: message,
      message,
    };
  },
}));

import { prisma } from '@documenso/prisma';

import { getFileServerSide } from '../../../universal/upload/get-file.server';
import { run } from './seal-document.handler';

const isLiveSigningTestEnabled = process.env.DOCUMENSO_LIVE_SIGNING_TEST === '1';

describe.skipIf(!isLiveSigningTestEnabled)('seal-document live signing integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(
    'should finalize a pending envelope by sending the prepared PDF to the HTTP signer',
    async () => {
      expect(process.env.NEXT_PRIVATE_SIGNING_TRANSPORT).toBe('http');
      expect(process.env.NEXT_PRIVATE_SIGNING_HTTP_URL).toBeTruthy();

      const pendingEnvelope = await prisma.envelope.findFirst({
        where: {
          type: EnvelopeType.DOCUMENT,
          status: DocumentStatus.PENDING,
          recipients: {
            every: {
              OR: [
                {
                  signingStatus: SigningStatus.SIGNED,
                },
                {
                  role: RecipientRole.CC,
                },
              ],
            },
          },
        },
        include: {
          envelopeItems: {
            include: {
              documentData: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(pendingEnvelope).toBeTruthy();

      if (!pendingEnvelope) {
        expect.unreachable('expected a pending fully-signed envelope for the live integration test');
      }

      const beforeDocumentDataId = pendingEnvelope.envelopeItems[0]?.documentDataId;

      expect(beforeDocumentDataId).toBeTruthy();

      const signingUrl = process.env.NEXT_PRIVATE_SIGNING_HTTP_URL!;
      const originalFetch = globalThis.fetch;
      const fetchSpy = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => await originalFetch(input, init),
      );

      vi.stubGlobal('fetch', fetchSpy);

      await run({
        payload: {
          documentId: Number(pendingEnvelope.secondaryId.replace('document_', '')),
          sendEmail: false,
          isResealing: false,
        },
        io: {
          runTask: async (_cacheKey, callback) => await callback(),
          triggerJob: async () => await Promise.resolve(undefined),
          wait: async () => await Promise.resolve(),
          logger: console,
        },
      });

      const finalizedEnvelope = await prisma.envelope.findFirstOrThrow({
        where: {
          id: pendingEnvelope.id,
        },
        include: {
          envelopeItems: {
            include: {
              documentData: true,
            },
          },
        },
      });

      expect(finalizedEnvelope.status).toBe(DocumentStatus.COMPLETED);
      expect(finalizedEnvelope.completedAt).toBeInstanceOf(Date);
      expect(finalizedEnvelope.envelopeItems[0]?.documentDataId).not.toBe(beforeDocumentDataId);

      const finalizedDocumentData = finalizedEnvelope.envelopeItems[0]?.documentData;

      expect(finalizedDocumentData).toBeTruthy();

      if (!finalizedDocumentData) {
        expect.unreachable('expected finalized document data to exist');
      }

      const finalizedPdfBytes = await getFileServerSide(finalizedDocumentData);
      const finalizedPdfBuffer = Buffer.from(finalizedPdfBytes);

      expect(finalizedPdfBuffer.includes(Buffer.from('/ByteRange'))).toBe(true);
      expect(
        finalizedPdfBuffer.includes(Buffer.from('Adobe.PPKLite')) ||
          finalizedPdfBuffer.includes(Buffer.from('adbe.pkcs7.detached')),
      ).toBe(true);

      const signingRequest = fetchSpy.mock.calls.find(([input]) => String(input) === signingUrl);

      expect(signingRequest).toBeTruthy();

      if (!signingRequest) {
        expect.unreachable('expected the HTTP signing bridge to be called');
      }

      const [, signingInit] = signingRequest;

      expect(signingInit?.method).toBe('POST');
      expect(signingInit?.body).toBeInstanceOf(FormData);

      const uploadedFile =
        signingInit?.body instanceof FormData ? signingInit.body.get('file') : null;

      expect(uploadedFile).toBeInstanceOf(File);
    },
    120_000,
  );
});
