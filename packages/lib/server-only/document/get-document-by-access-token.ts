import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { isPublicDocumentAccessEnabled } from '@documenso/lib/universal/document-access';
import { prisma } from '@documenso/prisma';

import { mapSecondaryIdToDocumentId } from '../../utils/envelope';

export type GetDocumentByAccessTokenOptions = {
  token: string;
};

export const getDocumentByAccessToken = async ({ token }: GetDocumentByAccessTokenOptions) => {
  if (!token) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Missing QR access token',
      statusCode: 401,
    });
  }

  const result = await prisma.envelope.findFirst({
    where: {
      type: EnvelopeType.DOCUMENT,
      qrToken: token,
    },
    // Do not provide extra information that is not needed.
    select: {
      id: true,
      secondaryId: true,
      status: true,
      internalVersion: true,
      title: true,
      completedAt: true,
      team: {
        select: {
          url: true,
          organisation: {
            select: {
              organisationGlobalSettings: {
                select: {
                  allowPublicCompletedDocumentAccess: true,
                },
              },
            },
          },
          teamGlobalSettings: {
            select: {
              allowPublicCompletedDocumentAccess: true,
            },
          },
        },
      },
      envelopeItems: {
        select: {
          id: true,
          title: true,
          order: true,
          documentDataId: true,
          envelopeId: true,
          documentData: {
            select: {
              id: true,
              type: true,
              data: true,
              initialData: true,
            },
          },
        },
      },
      _count: {
        select: {
          recipients: true,
        },
      },
    },
  });

  if (!result) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'QR token not found',
      statusCode: 404,
    });
  }

  if (result.status !== DocumentStatus.COMPLETED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Document is not fully completed',
      statusCode: 409,
    });
  }

  if (!isPublicDocumentAccessEnabled(result.team)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Public completed-document access is disabled for this document',
      statusCode: 403,
    });
  }

  const firstDocumentData = result.envelopeItems[0].documentData;

  if (!firstDocumentData) {
    throw new Error('Missing document data');
  }

  return {
    id: mapSecondaryIdToDocumentId(result.secondaryId),
    internalVersion: result.internalVersion,
    title: result.title,
    completedAt: result.completedAt,
    envelopeItems: result.envelopeItems,
    recipientCount: result._count.recipients,
    documentTeamUrl: result.team?.url ?? '',
  };
};
