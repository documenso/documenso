import { prisma } from '@documenso/prisma';
import type { DocumentData, Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { ContentImageMap } from '../../universal/content-renderer/content-renderer';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import type { EnvelopeContentSnapshot } from '../../utils/envelope-content';
import { areEnvelopeContentsEqual } from '../../utils/envelope-content';
import { generatePartialSignedPdf } from '../pdf/generate-partial-signed-pdf';
import type { OverlayContent } from '../pdf/insert-field-in-pdf-v2';

/**
 * Each render holds the item's PDF several times over (bytes, parsed document,
 * saved output, upload copy), so memory scales with how many items render at
 * once. Two keeps the S3 round trips overlapped without that.
 */
export const RENDER_CONTENTS_CONCURRENCY = 2;

type RenderContentsOntoPdfOptions = {
  pdfData: Uint8Array;
  contents: OverlayContent[];
  images?: ContentImageMap;
};

/**
 * Throws `MISSING_CONTENT_IMAGE` if an image content's image cannot be loaded,
 * since exporting it would silently drop it from the document.
 */
export const renderContentsOntoPdf = async ({ pdfData, contents, images }: RenderContentsOntoPdfOptions) => {
  if (contents.length === 0) {
    return pdfData;
  }

  return await generatePartialSignedPdf({ pdfData, fields: [], contents, images });
};

export type RenderedEnvelopeItem = {
  envelopeItemId: string;
  previousDocumentDataId: string;
  documentData: DocumentData;
};

type RenderContentsIntoEnvelopeItemOptions = {
  envelopeItemId: string;
  contents: OverlayContent[];
  images?: ContentImageMap;
};

/**
 * The item is deliberately NOT pointed at the new copy here. Sending renders
 * every item first and then switches them all together with
 * `commitRenderedEnvelopeItems`, inside the transaction that moves the
 * envelope on from DRAFT, so a failure anywhere in between leaves every item
 * on its original file rather than some on a rendered one which a later send
 * would render onto a second time.
 *
 * `initialData` is carried over untouched so the original upload remains
 * downloadable and a reseal, which starts over from `initialData` and
 * reinserts the contents itself, produces a single copy of each content.
 */
export const renderContentsIntoEnvelopeItem = async ({
  envelopeItemId,
  contents,
  images,
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
    images,
  });

  const { documentData: renderedDocumentData } = await putPdfFileServerSide(
    {
      name: envelopeItem.title,
      type: 'application/pdf',
      arrayBuffer: async () => Promise.resolve(renderedPdf),
    },
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
  contents: EnvelopeContentSnapshot[];
  renderedEnvelopeItems: RenderedEnvelopeItem[];
};

/**
 * Must run inside the transaction which moves the envelope on from DRAFT so
 * either every item switches or none does.
 *
 * Rendering happens outside that transaction, since it is slow, so a content
 * write can land in between. The write's own status check
 * (`assertContentCanBeChanged`) only catches the case where the send has
 * already committed; the check here catches the other order. Both sides take
 * the same `FOR UPDATE` lock on the envelope row, so whichever gets it second
 * sees the other's committed state and fails.
 *
 * Each switch is guarded by the document data the item pointed at when it was
 * rendered, so a concurrent send which already switched it aborts the
 * transaction rather than pointing the item at a render of a stale file.
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
