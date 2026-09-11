import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { isTspEnvelope } from '@documenso/lib/types/signature-level';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { prisma } from '@documenso/prisma';
import { PDF } from '@libpdf/core';

import { buildTspAnchorName, buildTspStampName } from './pdf-names';

export type MaterializeTspAnchorsForEnvelopeOptions = {
  envelopeId: string;
};

/**
 * Pre-allocate per-recipient AcroForm signature anchors and per-page `/Stamp`
 * overlay annotations on every envelope item of a TSP (AES/QES) envelope.
 *
 * Mutates the existing `DocumentData` row in place — the `envelopeItem.
 * documentDataId` pointer is preserved across materialisation. Materialise
 * is distribution housekeeping (pre-allocate fixed anchor slots before any
 * recipient signs), not a content version bump, so a pointer swap +
 * audit-log entry would mis-attribute the change. The new uploaded row
 * created by `putPdfFileServerSide` is kept as an orphan rather than
 * deleted — it preserves the standard upload mechanics (S3 PUT or BYTES_64
 * encode) without a separate "copy then drop" dance.
 *
 * Idempotent: re-runs are no-ops when every expected anchor/stamp is
 * already present. No-op for SES envelopes.
 */
export const materializeTspAnchorsForEnvelope = async ({
  envelopeId,
}: MaterializeTspAnchorsForEnvelopeOptions): Promise<void> => {
  const envelope = await prisma.envelope.findUnique({
    where: {
      id: envelopeId,
    },
    include: {
      recipients: true,
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
      fields: {
        select: {
          recipientId: true,
          envelopeItemId: true,
          page: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Envelope ${envelopeId} not found`,
    });
  }

  if (!isTspEnvelope(envelope)) {
    return;
  }

  if (envelope.recipients.length === 0) {
    return;
  }

  for (const envelopeItem of envelope.envelopeItems) {
    const expectedAnchorNames = envelope.recipients.map((recipient) =>
      buildTspAnchorName(recipient.id, envelopeItem.id),
    );

    const expectedStampNames: string[] = [];

    for (const recipient of envelope.recipients) {
      const pagesWithFields = new Set<number>();

      for (const field of envelope.fields) {
        if (field.recipientId === recipient.id && field.envelopeItemId === envelopeItem.id) {
          pagesWithFields.add(field.page);
        }
      }

      for (const page of pagesWithFields) {
        expectedStampNames.push(buildTspStampName(recipient.id, envelopeItem.id, page));
      }
    }

    const bytes = await getFileServerSide(envelopeItem.documentData);
    const pdfDoc = await PDF.load(bytes);

    if (isAlreadyMaterialised(pdfDoc, expectedAnchorNames, expectedStampNames)) {
      continue;
    }

    // Bake operator AcroForm, annotations and OCG layers into static graphics
    // so the materialised PDF is a deterministic surface. `skipSignatures`
    // preserves any operator-placed signature widgets and (on re-materialise)
    // the TSP anchors created previously.
    pdfDoc.flattenAll({
      form: {
        skipSignatures: true,
      },
    });

    const form = pdfDoc.getOrCreateForm();

    if (pdfDoc.getPageCount() === 0) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Envelope item ${envelopeItem.id} PDF has no pages`,
      });
    }

    // Anchors are AcroForm signature fields with no pre-attached widget.
    // libpdf forbids `drawField` for signature fields — at sign time
    // `pdf.sign({ fieldName })` promotes the existing field dict in place
    // to a merged field/widget (Type=Annot, Subtype=Widget, P=page0,
    // Rect=[0,0,0,0]) without modifying the page object. That preserves the
    // per-recipient `/ByteRange` invariant across sequential signatures.
    for (const anchorName of expectedAnchorNames) {
      if (form.getSignatureField(anchorName)) {
        continue;
      }

      form.createSignatureField(anchorName);
    }

    for (const recipient of envelope.recipients) {
      const pagesWithFields = new Set<number>();

      for (const field of envelope.fields) {
        if (field.recipientId === recipient.id && field.envelopeItemId === envelopeItem.id) {
          pagesWithFields.add(field.page);
        }
      }

      for (const pageNumber of pagesWithFields) {
        const stampName = buildTspStampName(recipient.id, envelopeItem.id, pageNumber);
        const page = pdfDoc.getPage(pageNumber - 1);

        if (!page) {
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message: `Envelope item ${envelopeItem.id} missing page ${pageNumber} referenced by field`,
          });
        }

        const existing = page.getStampAnnotations().some((stamp) => stamp.stampName === stampName);

        if (existing) {
          continue;
        }

        page.addStampAnnotation({
          name: stampName,
          rect: {
            x: 0,
            y: 0,
            width: page.width,
            height: page.height,
          },
        });
      }
    }

    const newBytes = await pdfDoc.save({ useXRefStream: true });

    // CRITICAL: persist via `putPdfFileServerSide` (raw). The normalised path
    // would call `form.flatten()` without `skipSignatures` and wipe anchors.
    const fileName = envelope.title.endsWith('.pdf') ? envelope.title : `${envelope.title || 'envelope'}.pdf`;

    const uploaded = await putPdfFileServerSide(
      {
        name: fileName,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(newBytes),
      },
      envelopeItem.documentData.initialData ?? undefined,
    );

    // Copy the persisted bytes reference (S3 key or BYTES_64 payload) onto the
    // existing DocumentData row in place. `envelopeItem.documentDataId` stays
    // put — see file-level docblock for the rationale.
    await prisma.documentData.update({
      where: { id: envelopeItem.documentDataId },
      data: {
        type: uploaded.documentData.type,
        data: uploaded.documentData.data,
      },
    });
  }
};

/**
 * Whole-item idempotency probe: returns true only when every expected anchor
 * and stamp name is already present on the loaded PDF. Partial state is
 * treated as not-materialised — the whole item is rebuilt.
 */
const isAlreadyMaterialised = (pdfDoc: PDF, expectedAnchorNames: string[], expectedStampNames: string[]): boolean => {
  const form = pdfDoc.getForm();

  if (!form) {
    return expectedAnchorNames.length === 0 && expectedStampNames.length === 0;
  }

  for (const anchorName of expectedAnchorNames) {
    if (!form.getSignatureField(anchorName)) {
      return false;
    }
  }

  if (expectedStampNames.length === 0) {
    return true;
  }

  const presentStampNames = new Set<string>();

  for (let i = 0; i < pdfDoc.getPageCount(); i++) {
    const page = pdfDoc.getPage(i);

    if (!page) {
      continue;
    }

    for (const stamp of page.getStampAnnotations()) {
      presentStampNames.add(stamp.stampName);
    }
  }

  return expectedStampNames.every((name) => presentStampNames.has(name));
};
