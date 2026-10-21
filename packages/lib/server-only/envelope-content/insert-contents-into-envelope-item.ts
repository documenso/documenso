import { prisma } from '@documenso/prisma';
import type { DocumentData, Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import type { EnvelopeContentSnapshot } from '../../utils/envelope-content';
import { areEnvelopeContentsEqual } from '../../utils/envelope-content';
import { generatePartialSignedPdf } from '../pdf/generate-partial-signed-pdf';
import type { OverlayContent } from '../pdf/insert-field-in-pdf-v2';

type RenderContentsOntoPdfOptions = {
  pdfData: Uint8Array;
  contents: OverlayContent[];
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

/**
 * An envelope item's PDF with its contents rendered in, which the item does
 * not point at yet. See `renderContentsIntoEnvelopeItem`.
 */
export type RenderedEnvelopeItem = {
  envelopeItemId: string;

  /**
   * The document data the item pointed at when the contents were rendered.
   */
  previousDocumentDataId: string;

  /**
   * The new document data holding the rendered PDF.
   */
  documentData: DocumentData;
};

type RenderContentsIntoEnvelopeItemOptions = {
  envelopeItemId: string;

  /**
   * The item's contents to render.
   */
  contents: OverlayContent[];
};

/**
 * Render an envelope item's contents into a new copy of its PDF so that
 * everything after DRAFT (signing, CSC/TSP, downloads) works from bytes which
 * already contain them.
 *
 * The item is deliberately NOT pointed at the new copy here. Sending renders
 * every item first and then switches them all together with
 * `commitRenderedEnvelopeItems`, inside the transaction that moves the
 * envelope on from DRAFT. A failure anywhere in between therefore leaves every
 * item on its original file rather than some on a rendered one, which a later
 * send would render onto a second time.
 *
 * The item's `DocumentData.initialData` is carried over untouched so the
 * original upload remains downloadable and a reseal, which starts over from
 * `initialData` and reinserts the contents itself, produces a single copy of
 * each content.
 *
 * Returns `null` when the item has no contents to render.
 */
export const renderContentsIntoEnvelopeItem = async ({
  envelopeItemId,
  contents,
}: RenderContentsIntoEnvelopeItemOptions): Promise<RenderedEnvelopeItem | null> => {
  if (contents.length === 0) {
    return null;
  }

  const envelopeItem = await prisma.envelopeItem.findFirst({
    where: {
      id: envelopeItemId,
    },
    include: {
      documentData: true,
    },
  });

  if (!envelopeItem) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Envelope item ${envelopeItemId} not found`,
    });
  }

  const currentPdf = await getFileServerSide(envelopeItem.documentData);

  const renderedPdf = await renderContentsOntoPdf({
    pdfData: currentPdf,
    contents,
  });

  const { documentData: renderedDocumentData } = await putPdfFileServerSide(
    {
      name: envelopeItem.title,
      type: 'application/pdf',
      arrayBuffer: async () => Promise.resolve(renderedPdf),
    },
    // Preserve the original document bytes.
    envelopeItem.documentData.initialData,
  );

  return {
    envelopeItemId: envelopeItem.id,
    previousDocumentDataId: envelopeItem.documentData.id,
    documentData: renderedDocumentData,
  };
};

type CommitRenderedEnvelopeItemsOptions = {
  envelopeId: string;

  /**
   * The envelope's contents as they were when rendered.
   */
  contents: EnvelopeContentSnapshot[];

  renderedEnvelopeItems: RenderedEnvelopeItem[];
};

/**
 * Point each envelope item at its rendered PDF, after verifying the contents
 * which were rendered are still the envelope's contents.
 *
 * Must run inside the transaction which moves the envelope on from DRAFT so
 * either every item switches or none does.
 *
 * Rendering happens outside that transaction, since it is slow, so a content
 * write can land in between. The write's own status check
 * (`assertContentCanBeChanged`) only catches the case where the send has
 * already committed; the check here catches the other order, where the write
 * committed first and the PDF was rendered from contents which no longer
 * exist. Both sides take the same `FOR UPDATE` lock on the envelope row, so
 * whichever gets it second sees the other's committed state and fails.
 *
 * Each switch is guarded by the document data the item pointed at when it was
 * rendered. If that has changed since, for example because a concurrent send
 * already switched it, the transaction is aborted rather than the item being
 * pointed at a render of a file which is no longer its current one.
 */
export const commitRenderedEnvelopeItems = async (
  tx: Prisma.TransactionClient,
  { envelopeId, contents, renderedEnvelopeItems }: CommitRenderedEnvelopeItemsOptions,
) => {
  await assertEnvelopeContentsUnchanged(tx, { envelopeId, contents });

  for (const { envelopeItemId, previousDocumentDataId, documentData } of renderedEnvelopeItems) {
    const { count } = await tx.envelopeItem.updateMany({
      where: {
        id: envelopeItemId,
        documentDataId: previousDocumentDataId,
      },
      data: {
        documentDataId: documentData.id,
      },
    });

    if (count !== 1) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Envelope item ${envelopeItemId} was modified while its contents were being inserted`,
      });
    }
  }
};

type AssertEnvelopeContentsUnchangedOptions = {
  envelopeId: string;
  contents: EnvelopeContentSnapshot[];
};

/**
 * Lock the envelope and verify its contents still match the given snapshot.
 */
const assertEnvelopeContentsUnchanged = async (
  tx: Prisma.TransactionClient,
  { envelopeId, contents }: AssertEnvelopeContentsUnchangedOptions,
) => {
  await tx.$queryRaw`SELECT "id" FROM "Envelope" WHERE "id" = ${envelopeId} FOR UPDATE`;

  const currentContents = await tx.envelopeContent.findMany({
    where: {
      envelopeId,
    },
    select: {
      id: true,
      envelopeItemId: true,
      contentMeta: true,
      dataContentId: true,
    },
  });

  if (!areEnvelopeContentsEqual(contents, currentContents)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'The envelope contents were modified while the document was being sent',
    });
  }
};
