import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnvelopeFindFirst, mockEnvelopeFindFirstOrThrow } = vi.hoisted(() => ({
  mockEnvelopeFindFirst: vi.fn(),
  mockEnvelopeFindFirstOrThrow: vi.fn(),
}));

vi.mock('@documenso/prisma', () => ({
  prisma: {
    envelope: {
      findFirst: mockEnvelopeFindFirst,
      findFirstOrThrow: mockEnvelopeFindFirstOrThrow,
    },
  },
}));

vi.mock('@documenso/ee/server-only/signing/csc/finalize-tsp-completion', () => ({
  finalizeTspEnvelopeCompletion: vi.fn(),
}));
vi.mock('@documenso/lib/server-only/pdf/add-rejection-stamp-to-pdf', () => ({ addRejectionStampToPdf: vi.fn() }));
vi.mock('@documenso/lib/server-only/pdf/generate-audit-log-pdf', () => ({ generateAuditLogPdf: vi.fn() }));
vi.mock('@documenso/lib/server-only/pdf/generate-certificate-pdf', () => ({ generateCertificatePdf: vi.fn() }));
vi.mock('@documenso/lib/server-only/pdf/get-page-size', () => ({ getLastPageDimensions: vi.fn() }));
vi.mock('@documenso/signing', () => ({ signPdf: vi.fn() }));
vi.mock('../../../constants/app', () => ({ NEXT_PRIVATE_USE_PLAYWRIGHT_PDF: false }));
vi.mock('../../../server-only/htmltopdf/get-audit-logs-pdf', () => ({ getAuditLogsPdf: vi.fn() }));
vi.mock('../../../server-only/htmltopdf/get-certificate-pdf', () => ({ getCertificatePdf: vi.fn() }));
vi.mock('../../../server-only/pdf/insert-field-in-pdf-v1', () => ({ insertFieldInPDFV1: vi.fn() }));
vi.mock('../../../server-only/pdf/insert-field-in-pdf-v2', () => ({ insertFieldInPDFV2: vi.fn() }));
vi.mock('../../../server-only/pdf/legacy-insert-field-in-pdf', () => ({ legacy_insertFieldInPDF: vi.fn() }));
vi.mock('../../../server-only/team/get-team-settings', () => ({ getTeamSettings: vi.fn() }));
vi.mock('../../../server-only/webhooks/trigger/trigger-webhook', () => ({ triggerWebhook: vi.fn() }));
vi.mock('../../../universal/upload/get-file.server', () => ({ getFileServerSide: vi.fn() }));
vi.mock('../../../universal/upload/put-file.server', () => ({ putPdfFileServerSide: vi.fn() }));
vi.mock('../../client', () => ({ jobs: { triggerJob: vi.fn() } }));

import { DocumentStatus } from '@prisma/client';

import { run } from './seal-document.handler';

const mockIo = {
  runTask: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
} as never;

describe('seal-document handler idempotency guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no-ops when the envelope is already COMPLETED (duplicate trigger)', async () => {
    mockEnvelopeFindFirst.mockResolvedValue({ status: DocumentStatus.COMPLETED });

    await run({ payload: { documentId: 1 }, io: mockIo });

    // The duplicate trigger must not continue into the sealing path.
    expect(mockEnvelopeFindFirstOrThrow).not.toHaveBeenCalled();
  });

  it('no-ops when the envelope is already REJECTED (duplicate trigger)', async () => {
    mockEnvelopeFindFirst.mockResolvedValue({ status: DocumentStatus.REJECTED });

    await run({ payload: { documentId: 1 }, io: mockIo });

    expect(mockEnvelopeFindFirstOrThrow).not.toHaveBeenCalled();
  });

  it('proceeds when the envelope is still PENDING', async () => {
    mockEnvelopeFindFirst.mockResolvedValue({ status: DocumentStatus.PENDING });
    mockEnvelopeFindFirstOrThrow.mockRejectedValue(new Error('stop here'));

    await expect(run({ payload: { documentId: 1 }, io: mockIo })).rejects.toThrow('stop here');

    expect(mockEnvelopeFindFirstOrThrow).toHaveBeenCalled();
  });

  it('proceeds for an explicit admin reseal of a COMPLETED envelope', async () => {
    mockEnvelopeFindFirst.mockResolvedValue({ status: DocumentStatus.COMPLETED });
    mockEnvelopeFindFirstOrThrow.mockRejectedValue(new Error('stop here'));

    await expect(run({ payload: { documentId: 1, isResealing: true }, io: mockIo })).rejects.toThrow('stop here');

    expect(mockEnvelopeFindFirstOrThrow).toHaveBeenCalled();
  });
});
