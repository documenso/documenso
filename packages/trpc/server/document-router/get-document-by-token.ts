import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetDocumentByTokenRequestSchema,
  ZGetDocumentByTokenResponseSchema,
} from './get-document-by-token.types';

export const getDocumentByTokenRoute = authenticatedProcedure
  .input(ZGetDocumentByTokenRequestSchema)
  .output(ZGetDocumentByTokenResponseSchema)
  .query(async ({ input, ctx }) => {
    const { token } = input;

    const document = await prisma.document.findFirst({
      where: {
        recipients: {
          some: {
            token,
            email: ctx.user.email,
          },
        },
      },
      include: {
        documentData: true,
      },
    });

    if (!document) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Document not found',
      });
    }

    ctx.logger.info({
      documentId: document.id,
    });

    return {
      documentData: document.documentData,
    };
  });
