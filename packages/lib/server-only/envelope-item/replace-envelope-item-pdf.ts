import { PDF } from '@libpdf/core';
import type { Envelope } from '@prisma/client';

import { normalizePdf } from '@documenso/lib/server-only/pdf/normalize-pdf';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

type UnsafeReplaceEnvelopeItemPdfOptions = {
  envelope: Pick<Envelope, 'id' | 'type'>;

  /**
   * The ID of the envelope item which we will be replacing the PDF for.
   */
  envelopeItemId: string;

  /**
   * The ID of the old document data we will be deleting.
   */
  oldDocumentDataId: string;

  /**
   * The data we will be replacing.
   */
  data: {
    title?: string;
    order?: number;
    file: File;
  };

  user: {
    id: number;
    name: string | null;
    email: string;
  };
  apiRequestMetadata: ApiRequestMetadata;
};

type UnsafeReplaceEnvelopeItemPdfResult = {
  updatedItem: {
    id: string;
    title: string;
    envelopeId: string;
    order: number;
    documentDataId: string;
  };
  deletedFieldIds: number[];
};

export const UNSAFE_replaceEnvelopeItemPdf = async ({
  envelope,
  envelopeItemId,
  oldDocumentDataId,
  data,
  user,
  apiRequestMetadata,
}: UnsafeReplaceEnvelopeItemPdfOptions): Promise<UnsafeReplaceEnvelopeItemPdfResult> => {
  const buffer = Buffer.from(await data.file.arrayBuffer());
  const normalized = await normalizePdf(buffer, {
    flattenForm: envelope.type !== 'TEMPLATE',
  });

  // Count the pages to remove out of bound fields.
  const pdfDoc = await PDF.load(normalized);
  const newPageCount = pdfDoc.getPageCount();

  // Upload the new PDF and get a new DocumentData record.
  const { id: newDocumentDataId } = await putPdfFileServerSide({
    name: data.file.name,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(normalized),
  });

  return await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.envelopeItem.update({
      where: {
        id: envelopeItemId,
        envelopeId: envelope.id,
      },
      data: {
        documentDataId: newDocumentDataId,
        title: data.title,
        order: data.order,
      },
    });

    // Todo: Audit log if we're updating the title or order.

    // Delete the old DocumentData (now orphaned).
    await tx.documentData.delete({
      where: {
        id: oldDocumentDataId,
      },
    });

    // Delete fields that reference pages beyond the new PDF's page count.
    const outOfBoundsFields = await tx.field.findMany({
      where: {
        envelopeId: envelope.id,
        envelopeItemId,
        page: {
          gt: newPageCount,
        },
      },
      select: {
        id: true,
      },
    });

    const deletedFieldIds = outOfBoundsFields.map((f) => f.id);

    if (deletedFieldIds.length > 0) {
      await tx.field.deleteMany({
        where: {
          id: {
            in: deletedFieldIds,
          },
        },
      });
    }

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.ENVELOPE_ITEM_PDF_REPLACED,
        envelopeId: envelope.id,
        data: {
          envelopeItemId: updatedItem.id,
          envelopeItemTitle: updatedItem.title,
        },
        user: {
          name: user.name,
          email: user.email,
        },
        requestMetadata: apiRequestMetadata.requestMetadata,
      }),
    });

    return {
      updatedItem,
      deletedFieldIds,
    };
  });
};
