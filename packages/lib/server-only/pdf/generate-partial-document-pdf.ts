import { PDFDocument } from '@cantoo/pdf-lib';
import { PDF } from '@libpdf/core';
import type { DocumentData, Envelope, EnvelopeItem, Field } from '@prisma/client';
import { groupBy } from 'remeda';

import { prisma } from '@documenso/prisma';

import { getFileServerSide } from '../../universal/upload/get-file.server';
import { addDraftStampToPdf } from './add-draft-stamp-to-pdf';
import { insertFieldInPDFV1 } from './insert-field-in-pdf-v1';
import { insertFieldInPDFV2 } from './insert-field-in-pdf-v2';
import { legacy_insertFieldInPDF } from './legacy-insert-field-in-pdf';
import { mergePageContentStreams } from './merge-page-content-streams';

export type GeneratePartialDocumentPdfOptions = {
  envelopeId: string;
  envelopeItemId: string;
};

/**
 * Generates a partially-signed PDF for an envelope item that has not yet been
 * fully completed. Embeds any fields that have already been inserted (signed)
 * by recipients, leaves unsigned field placeholders visually empty, and overlays
 * a "DRAFT — NOT FULLY EXECUTED" watermark on every page so the result cannot
 * be mistaken for a completed/sealed document.
 *
 * Unlike the seal-document handler, this does NOT digitally sign the PDF, does
 * not embed the certificate/audit log, and does not persist a new DocumentData
 * record — it returns transient PDF bytes for download.
 */
export const generatePartialDocumentPdf = async ({
  envelopeId,
  envelopeItemId,
}: GeneratePartialDocumentPdfOptions): Promise<Uint8Array> => {
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { id: envelopeId },
    include: {
      envelopeItems: {
        where: { id: envelopeItemId },
        include: {
          documentData: true,
          field: {
            include: { signature: true },
          },
        },
      },
    },
  });

  const envelopeItem = envelope.envelopeItems[0];

  if (!envelopeItem) {
    throw new Error(`Envelope item ${envelopeItemId} not found in envelope ${envelopeId}`);
  }

  return await renderPartialPdfForEnvelopeItem({
    envelope,
    envelopeItem,
    fields: envelopeItem.field,
  });
};

type RenderPartialPdfOptions = {
  envelope: Pick<Envelope, 'id' | 'useLegacyFieldInsertion' | 'internalVersion'>;
  envelopeItem: EnvelopeItem & { documentData: DocumentData };
  fields: Field[];
};

const renderPartialPdfForEnvelopeItem = async ({
  envelope,
  envelopeItem,
  fields,
}: RenderPartialPdfOptions): Promise<Uint8Array> => {
  // Use the initial (unmodified) PDF as the base. The `data` field gets
  // replaced when the document is sealed; while signing is in progress the
  // two are typically equal, but initialData is the safe, unambiguous source.
  const pdfData = await getFileServerSide({
    type: envelopeItem.documentData.type,
    data: envelopeItem.documentData.initialData,
  });

  // Only insert fields that have already been filled in by a recipient. Fields
  // belonging to recipients who have not yet signed remain visually empty.
  const insertedFields = fields.filter((field) => field.inserted);

  let pdfDoc = await PDF.load(pdfData);

  mergePageContentStreams(pdfDoc);
  pdfDoc.flattenAll();
  pdfDoc.upgradeVersion('1.7');

  if (envelope.internalVersion === 1 && insertedFields.length > 0) {
    const legacy_pdfLibDoc = await PDFDocument.load(await pdfDoc.save({ useXRefStream: true }));

    for (const field of insertedFields) {
      if (envelope.useLegacyFieldInsertion) {
        await legacy_insertFieldInPDF(legacy_pdfLibDoc, field);
      } else {
        await insertFieldInPDFV1(legacy_pdfLibDoc, field);
      }
    }

    legacy_pdfLibDoc.getForm().flatten();

    await pdfDoc.reload(await legacy_pdfLibDoc.save());
  }

  if (envelope.internalVersion === 2 && insertedFields.length > 0) {
    const fieldsGroupedByPage = groupBy(insertedFields, (field) => field.page);

    for (const [pageNumber, pageFields] of Object.entries(fieldsGroupedByPage)) {
      const page = pdfDoc.getPage(Number(pageNumber) - 1);

      if (!page) {
        continue;
      }

      const pageWidth = page.width;
      const pageHeight = page.height;

      const overlayBytes = await insertFieldInPDFV2({
        pageWidth,
        pageHeight,
        fields: pageFields,
      });

      const overlayPdf = await PDF.load(overlayBytes);
      const embeddedPage = await pdfDoc.embedPage(overlayPdf, 0);

      let translateX = 0;
      let translateY = 0;

      switch (page.rotation) {
        case 90:
          translateX = pageHeight;
          translateY = 0;
          break;
        case 180:
          translateX = pageWidth;
          translateY = pageHeight;
          break;
        case 270:
          translateX = 0;
          translateY = pageWidth;
          break;
      }

      page.drawPage(embeddedPage, {
        x: translateX,
        y: translateY,
        rotate: {
          angle: page.rotation,
        },
      });
    }
  }

  mergePageContentStreams(pdfDoc);
  pdfDoc.flattenAll();

  // Reload so we can layer the draft stamp on top of the flattened content.
  pdfDoc = await PDF.load(await pdfDoc.save({ useXRefStream: true }));

  await addDraftStampToPdf(pdfDoc);

  return await pdfDoc.save({ useXRefStream: true });
};
