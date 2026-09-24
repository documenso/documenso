import { prisma } from '@documenso/prisma';
import type { EnvelopeContent } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import { generatePartialSignedPdf } from '../pdf/generate-partial-signed-pdf';

type RenderContentsOntoPdfOptions = {
  pdfData: Uint8Array;
  contents: EnvelopeContent[];
};

/**
 * Draw the given contents onto a PDF and return the new bytes.
 *
 * Throws `MISSING_CONTENT_IMAGE` if an image content's image cannot be
 * loaded, since exporting it would silently drop it from the document.
 */
export const renderContentsOntoPdf = async ({ pdfData, contents }: RenderContentsOntoPdfOptions) => {
  if (contents.length === 0) {
    return pdfData;
  }

  return await generatePartialSignedPdf({ pdfData, fields: [], contents });
};

type BakeContentsIntoEnvelopeItemOptions = {
  envelopeItemId: string;
};

/**
 * Render an envelope item's contents into its PDF so that everything after
 * DRAFT (signing, CSC/TSP, downloads) works from bytes which already contain
 * them.
 *
 * The item's `DocumentData.initialData` is carried over untouched so the
 * original upload remains downloadable and the seal - which starts from
 * `initialData` and inserts the contents itself - keeps producing a single
 * copy of each content.
 */
export const insertContentsIntoEnvelopeItem = async ({ envelopeItemId }: BakeContentsIntoEnvelopeItemOptions) => {
  const envelopeItem = await prisma.envelopeItem.findFirst({
    where: {
      id: envelopeItemId,
    },
    include: {
      documentData: true,
      contents: true,
    },
  });

  if (!envelopeItem) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Envelope item ${envelopeItemId} not found`,
    });
  }

  if (envelopeItem.contents.length === 0) {
    return;
  }

  const currentPdf = await getFileServerSide(envelopeItem.documentData);

  const bakedPdf = await renderContentsOntoPdf({
    pdfData: currentPdf,
    contents: envelopeItem.contents,
  });

  const { documentData: bakedDocumentData } = await putPdfFileServerSide(
    {
      name: envelopeItem.title,
      type: 'application/pdf',
      arrayBuffer: async () => Promise.resolve(bakedPdf),
    },
    // Preserve the original document bytes.
    envelopeItem.documentData.initialData,
  );

  await prisma.envelopeItem.update({
    where: {
      id: envelopeItem.id,
    },
    data: {
      documentDataId: bakedDocumentData.id,
    },
  });
};
