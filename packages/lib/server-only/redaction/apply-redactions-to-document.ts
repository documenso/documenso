import type { DocumentData, EnvelopeItem, Redaction } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import { applyRedactionsToPdf } from '../pdf/apply-redactions-to-pdf';
import { normalizePdf } from '../pdf/normalize-pdf';
import { stripPdfMetadata } from '../pdf/strip-pdf-metadata';

type ApplyRedactionsToDocumentOptions = {
  envelopeItem: Pick<EnvelopeItem, 'id' | 'title'> & { documentData: DocumentData };
  redactions: Pick<Redaction, 'page' | 'positionX' | 'positionY' | 'width' | 'height'>[];
};

/**
 * Orchestrates the end-to-end redaction pipeline for a single envelope item:
 *
 *   original bytes → flatten → rasterize-replace redacted pages → strip
 *   metadata → store as a new DocumentData.
 *
 * Overwrites both `DocumentData.data` AND `initialData` (via the
 * `createDocumentData` default) so a later reseal — which uses `initialData`
 * — cannot resurrect the unredacted original.
 *
 * No-op when `redactions` is empty.
 */
export const applyRedactionsToDocument = async ({
  envelopeItem,
  redactions,
}: ApplyRedactionsToDocumentOptions): Promise<void> => {
  if (redactions.length === 0) {
    return;
  }

  const originalBytes = await getFileServerSide(envelopeItem.documentData);

  const flattened = await normalizePdf(Buffer.from(originalBytes), { flattenForm: true });

  const redactedBytes = await applyRedactionsToPdf({
    pdfBytes: new Uint8Array(flattened),
    redactions: redactions.map((r) => ({
      page: r.page,
      positionX: Number(r.positionX),
      positionY: Number(r.positionY),
      width: Number(r.width),
      height: Number(r.height),
    })),
  });

  const sanitizedBytes = await stripPdfMetadata(redactedBytes);

  const fileName = envelopeItem.title.endsWith('.pdf')
    ? envelopeItem.title
    : `${envelopeItem.title}.pdf`;

  const { documentData: newDocumentData } = await putPdfFileServerSide({
    name: fileName,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(sanitizedBytes),
  });

  await prisma.envelopeItem.update({
    where: { id: envelopeItem.id },
    data: { documentDataId: newDocumentData.id },
  });
};
