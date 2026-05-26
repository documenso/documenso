import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import type { CreateDocumentAuditLogDataResponse } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { HttpTimestampAuthority, PDF, type TimestampAuthority } from '@libpdf/core';
import type { DocumentData, DocumentMeta, Envelope, EnvelopeItem, Recipient, User } from '@prisma/client';
import { DocumentStatus } from '@prisma/client';
import { getCscTransport } from './transport';
import { type CscTsaConfig, resolveCscTsa } from './tsa-resolver';

/**
 * TSP envelope finalisation step run from the `seal-document` job.
 *
 * Replaces the SES "decorate + p12 sign" pass: recipient bytes are already
 * PAdES-signed by each recipient's CSC TSP, so the seal step is reduced to
 * a per-item PAdES B-LTA upgrade — libpdf's `pdf.addArchivalData()` runs
 * the full archive sequence (DSS for every existing signature + archival
 * `/DocTimeStamp` + DSS for the timestamp's own chain), and the resulting
 * bytes are copied in-place onto each `envelopeItem.documentData` row.
 * `envelopeItem.documentDataId` stays stable across the whole envelope
 * lifecycle (materialise → per-recipient signs → finalise) — mirrors the
 * pattern used by `materializeTspAnchorsForEnvelope` and `executeTspSign`.
 *
 * Certificate / audit-log sidecar PDFs are intentionally NOT merged into
 * the signed bytes here — they're rendered on-demand at download time so
 * the signed PDF stays byte-identical to what each recipient's SAD
 * authorised. Rejection and resealing are unsupported in V1 and rejected
 * by the caller before this runs.
 */

export type FinalizeTspEnvelopeCompletionOptions = {
  envelope: Envelope & {
    documentMeta: DocumentMeta | null;
    recipients: Recipient[];
    envelopeItems: Array<EnvelopeItem & { documentData: DocumentData }>;
    user: Pick<User, 'name' | 'email'>;
  };
  envelopeCompletedAuditLog: CreateDocumentAuditLogDataResponse;
  requestMetadata?: RequestMetadata;
};

type ArchivedItem = {
  /** Existing `envelopeItem.documentDataId` — target of the in-place update. */
  envelopeItemDataId: string;
  uploadedType: DocumentData['type'];
  uploadedData: string;
};

export const finalizeTspEnvelopeCompletion = async (opts: FinalizeTspEnvelopeCompletionOptions): Promise<void> => {
  const { envelope, envelopeCompletedAuditLog } = opts;

  // Resolve the TSA up-front — fail fast if the instance is mis-configured
  // before we start round-tripping PDF bytes through storage.
  const transport = await getCscTransport();
  const tsa = resolveCscTsa(transport);
  const timestampAuthority = buildLibpdfTsa(tsa);

  const archivedItems: ArchivedItem[] = [];

  for (const envelopeItem of envelope.envelopeItems) {
    const pdfBytes = await getFileServerSide(envelopeItem.documentData);
    const pdfDoc = await PDF.load(pdfBytes);

    // PAdES B-LTA in one call. Internally:
    //   1. Gather LTV (certs/OCSP/CRL) for every existing signed field and
    //      write a single DSS incremental update.
    //   2. Add an archival `/DocTimeStamp` over the result.
    //   3. Gather LTV for the new timestamp's own certificate chain.
    // All three are append-only incremental updates — every prior recipient
    // signature's `/ByteRange` stays valid.
    const archived = await pdfDoc.addArchivalData({ timestampAuthority });

    const { documentData: uploaded } = await putPdfFileServerSide(
      {
        name: envelopeItem.title.endsWith('.pdf') ? envelopeItem.title : `${envelopeItem.title}.pdf`,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(archived.bytes),
      },
      envelopeItem.documentData.initialData,
    );

    archivedItems.push({
      envelopeItemDataId: envelopeItem.documentData.id,
      uploadedType: uploaded.type,
      uploadedData: uploaded.data,
    });
  }

  // Single tx: per-item in-place data updates + envelope status flip +
  // completion audit log. `envelopeItem.documentDataId` is preserved; the
  // freshly-uploaded `DocumentData` rows orbit as orphans.
  await prisma.$transaction(async (tx) => {
    for (const { envelopeItemDataId, uploadedType, uploadedData } of archivedItems) {
      await tx.documentData.update({
        where: { id: envelopeItemDataId },
        data: { type: uploadedType, data: uploadedData },
      });
    }

    await tx.envelope.update({
      where: { id: envelope.id },
      data: {
        status: DocumentStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    await tx.documentAuditLog.create({
      data: envelopeCompletedAuditLog,
    });
  });
};

/**
 * Wrap a resolved {@link CscTsaConfig} into a libpdf `TimestampAuthority`.
 *
 * - `source: 'env'` — RFC 3161 endpoint, libpdf's `HttpTimestampAuthority`
 *   handles it directly. First URL only (V1; multi-URL fallback can layer
 *   on later via a composite wrapper).
 * - `source: 'tsp'` — CSC §11.10 JSON POST with a service-scope bearer.
 *   Requires resolving "whose service token" and round-tripping through
 *   the CSC client. Out of scope for V1; throws `NOT_SETUP` pointing
 *   operators at the env override so the failure mode is actionable.
 */
const buildLibpdfTsa = (tsa: CscTsaConfig): TimestampAuthority => {
  if (tsa.source === 'env') {
    return new HttpTimestampAuthority(tsa.urls[0]);
  }

  throw new AppError(AppErrorCode.NOT_SETUP, {
    message:
      'CSC §11.10 timestamp wrapping is not implemented in V1. Set NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY to a RFC 3161 TSA URL to enable B-LTA archive timestamps.',
  });
};
