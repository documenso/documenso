import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { EnvelopeContentType } from '../../types/envelope-content-meta';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { canContentBeChanged, type EnvelopeIdOptions } from '../../utils/envelope';
import { createDataContentImage } from '../data-content/create-data-content-image';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type UploadEnvelopeContentImageOptions = {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  envelopeContentId: string;
  file: File;
  requestMetadata: ApiRequestMetadata;
};

/**
 * Store an image and attach it to an image content.
 *
 * This is the only way a data content comes into being. The content must
 * already exist, so the client flushes its pending saves before calling
 * this, and the dialog which drives it keeps the editor blocked until it
 * settles - so there is never more than one upload in flight.
 */
export const uploadEnvelopeContentImage = async ({
  userId,
  teamId,
  id,
  envelopeContentId,
  file,
  requestMetadata,
}: UploadEnvelopeContentImageOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: null,
    userId,
    teamId,
  });

  const content = await prisma.envelopeContent.findFirst({
    where: {
      id: envelopeContentId,
      envelope: envelopeWhereInput,
    },
    include: {
      envelope: {
        select: {
          id: true,
          type: true,
          status: true,
        },
      },
    },
  });

  if (!content) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Content not found',
    });
  }

  if (!canContentBeChanged(content.envelope)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Contents can no longer be modified for this envelope',
    });
  }

  if (content.contentMeta.type !== EnvelopeContentType.IMAGE) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `A ${content.contentMeta.type} content cannot hold an image`,
    });
  }

  const dataContent = await createDataContentImage({ file });

  const updatedContent = await prisma.$transaction(async (tx) => {
    const updated = await tx.envelopeContent.update({
      where: {
        id: content.id,
      },
      data: {
        dataContentId: dataContent.id,
      },
    });

    // Templates are not audit logged, matching `setEnvelopeContents`.
    if (content.envelope.type === EnvelopeType.DOCUMENT) {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.CONTENT_UPDATED,
          envelopeId: content.envelope.id,
          metadata: requestMetadata,
          data: {
            contentId: content.id,
            contentType: content.contentMeta.type,
            envelopeItemId: content.envelopeItemId,
            changes: [
              {
                type: 'PROPERTY',
                key: 'dataContentId',
                from: content.dataContentId,
                to: dataContent.id,
              },
            ],
          },
        }),
      });
    }

    return updated;
  });

  return {
    content: updatedContent,
    dataContent,
  };
};
