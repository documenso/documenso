import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { isPublicDocumentAccessEnabled } from '@documenso/lib/universal/document-access';
import { prisma } from '@documenso/prisma';

import { maybeAuthenticatedProcedure } from '../trpc';
import {
  ZGetEnvelopeItemsByTokenRequestSchema,
  ZGetEnvelopeItemsByTokenResponseSchema,
} from './get-envelope-items-by-token.types';

// Not intended for V2 API usage.
// NOTE: THIS IS A PUBLIC PROCEDURE
export const getEnvelopeItemsByTokenRoute = maybeAuthenticatedProcedure
  .input(ZGetEnvelopeItemsByTokenRequestSchema)
  .output(ZGetEnvelopeItemsByTokenResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, user } = ctx;

    const { envelopeId, access } = input;

    ctx.logger.info({
      input: {
        envelopeId,
        access,
      },
    });

    if (access.type === 'user') {
      if (!user || !teamId) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'User not found',
        });
      }

      const { envelopeItems: data } = await handleGetEnvelopeItemsByUser({
        envelopeId,
        userId: user.id,
        teamId,
      });

      return {
        data,
      };
    }

    const { envelopeItems: data } = await handleGetEnvelopeItemsByToken({
      envelopeId,
      token: access.token,
    });

    return {
      data,
    };
  });

const handleGetEnvelopeItemsByToken = async ({
  envelopeId,
  token,
}: {
  envelopeId: string;
  token: string;
}) => {
  const isQrToken = token.startsWith('qr_');

  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
      type: EnvelopeType.DOCUMENT,
      ...(isQrToken
        ? { qrToken: token, status: DocumentStatus.COMPLETED }
        : { recipients: { some: { token } } }),
    },
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
      team: {
        include: {
          teamGlobalSettings: {
            select: { allowPublicCompletedDocumentAccess: true },
          },
          organisation: {
            include: {
              organisationGlobalSettings: {
                select: { allowPublicCompletedDocumentAccess: true },
              },
            },
          },
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope could not be found',
    });
  }

  if (isQrToken && !isPublicDocumentAccessEnabled(envelope.team)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Public completed-document access is disabled',
    });
  }

  return {
    envelopeItems: envelope.envelopeItems,
  };
};

const handleGetEnvelopeItemsByUser = async ({
  envelopeId,
  userId,
  teamId,
}: {
  envelopeId: string;
  userId: number;
  teamId: number;
}) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'envelopeId',
      id: envelopeId,
    },
    type: null,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findUnique({
    where: envelopeWhereInput,
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope could not be found',
    });
  }

  return {
    envelopeItems: envelope.envelopeItems,
  };
};
