import { DocumentDataType } from '@prisma/client';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { createDocumentV2 } from '@documenso/lib/server-only/document/create-document-v2';
import { getPresignPostUrl } from '@documenso/lib/universal/upload/server-actions';

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

    const createdDocument = await createDocumentV2({
      userId: ctx.user.id,
      teamId,
      documentDataId: documentData.id,
      normalizePdf: false, // Not normalizing because of presigned URL.
      data: {
        title,
        externalId,
        visibility,
        globalAccessAuth,
        globalActionAuth,
        recipients,
        folderId,
      },
      meta,
      requestMetadata: ctx.metadata,
    });

    return {
      document: createdDocument,
      folder: createdDocument.folder, // Todo: Remove this prior to api-v2 release.
      uploadUrl: url,
    };
  });
