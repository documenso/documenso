import { DocumentDataType, EnvelopeType } from '@prisma/client';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { getPresignPostUrl } from '@documenso/lib/universal/upload/server-actions';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateDocumentTemporaryRequestSchema,
  ZCreateDocumentTemporaryResponseSchema,
  createDocumentTemporaryMeta,
} from './create-document-temporary.types';

/**
 * Temporariy endpoint for V2 Beta until we allow passthrough documents on create.
 *
 * @public
 * @deprecated
 */
export const createDocumentTemporaryRoute = authenticatedProcedure
  .meta(createDocumentTemporaryMeta)
  .input(ZCreateDocumentTemporaryRequestSchema)
  .output(ZCreateDocumentTemporaryResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;

    const {
      title,
      externalId,
      visibility,
      globalAccessAuth,
      globalActionAuth,
      recipients,
      meta,
      folderId,
      attachments,
    } = input;

    const { remaining } = await getServerLimits({ userId: user.id, teamId });

    if (remaining.documents <= 0) {
      throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
        message: 'You have reached your document limit for this month. Please upgrade your plan.',
        statusCode: 400,
      });
    }

    const fileName = title.endsWith('.pdf') ? title : `${title}.pdf`;

    const { url, key } = await getPresignPostUrl(fileName, 'application/pdf');

    const documentData = await createDocumentData({
      data: key,
      type: DocumentDataType.S3_PATH,
    });

    const createdEnvelope = await createEnvelope({
      userId: ctx.user.id,
      teamId,
      normalizePdf: false, // Not normalizing because of presigned URL.
      internalVersion: 1,
      data: {
        type: EnvelopeType.DOCUMENT,
        title,
        externalId,
        visibility,
        globalAccessAuth,
        globalActionAuth,
        recipients: (recipients || []).map((recipient) => ({
          ...recipient,
          fields: (recipient.fields || []).map((field) => ({
            ...field,
            page: field.pageNumber,
            positionX: field.pageX,
            positionY: field.pageY,
            documentDataId: documentData.id,
          })),
        })),
        folderId,
        envelopeItems: [
          {
            // If you ever allow more than 1 in this endpoint, make sure to use `maximumEnvelopeItemCount` to limit it.
            documentDataId: documentData.id,
          },
        ],
      },
      attachments,
      meta: {
        ...meta,
        emailSettings: meta?.emailSettings ?? undefined,
      },
      requestMetadata: ctx.metadata,
    });

    const envelopeItems = await prisma.envelopeItem.findMany({
      where: {
        envelopeId: createdEnvelope.id,
      },
      include: {
        documentData: true,
      },
    });

    const legacyDocumentId = mapSecondaryIdToDocumentId(createdEnvelope.secondaryId);

    const firstDocumentData = envelopeItems[0].documentData;

    if (!firstDocumentData) {
      throw new Error('Document data not found');
    }

    return {
      document: {
        ...createdEnvelope,
        envelopeId: createdEnvelope.id,
        documentDataId: firstDocumentData.id,
        documentData: {
          ...firstDocumentData,
          envelopeItemId: envelopeItems[0].id,
        },
        documentMeta: {
          ...createdEnvelope.documentMeta,
          documentId: legacyDocumentId,
        },
        id: legacyDocumentId,
        fields: createdEnvelope.fields.map((field) => ({
          ...field,
          documentId: legacyDocumentId,
          templateId: null,
        })),
        recipients: createdEnvelope.recipients.map((recipient) => ({
          ...recipient,
          documentId: legacyDocumentId,
          templateId: null,
        })),
      },
      folder: createdEnvelope.folder, // Todo: Remove this prior to api-v2 release.
      uploadUrl: url,
    };
  });
