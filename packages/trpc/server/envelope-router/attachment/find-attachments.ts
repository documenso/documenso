import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { findAttachmentsByEnvelopeId } from '@documenso/lib/server-only/envelope-attachment/find-attachments-by-envelope-id';
import { findAttachmentsByToken } from '@documenso/lib/server-only/envelope-attachment/find-attachments-by-token';

import { maybeAuthenticatedProcedure } from '../../trpc';
import {
  ZFindAttachmentsRequestSchema,
  ZFindAttachmentsResponseSchema,
} from './find-attachments.types';

export const findAttachmentsRoute = maybeAuthenticatedProcedure
  .meta({
    openapi: {
      method: 'GET',
      path: '/envelope/attachment',
      summary: 'Find attachments',
      description: 'Find all attachments for an envelope',
      tags: ['Envelope Attachment'],
    },
  })
  .input(ZFindAttachmentsRequestSchema)
  .output(ZFindAttachmentsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { envelopeId, token } = input;

    ctx.logger.info({
      input: { envelopeId },
    });

    if (token) {
      const data = await findAttachmentsByToken({ envelopeId, token });

      return {
        data,
      };
    }

    const { teamId } = ctx;
    const userId = ctx.user?.id;

    if (!userId || !teamId) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You must be authenticated to access this resource',
      });
    }

    const data = await findAttachmentsByEnvelopeId({ envelopeId, teamId, userId });

    return {
      data,
    };
  });
