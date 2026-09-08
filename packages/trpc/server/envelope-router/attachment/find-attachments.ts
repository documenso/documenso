import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { findAttachmentsByEnvelopeId } from '@documenso/lib/server-only/envelope-attachment/find-attachments-by-envelope-id';
import { findAttachmentsByToken } from '@documenso/lib/server-only/envelope-attachment/find-attachments-by-token';

import { maybeAuthenticatedProcedure } from '../../trpc';
import { TWO_FACTOR_SKIP, twoFactorScope } from '../../two-factor-enforcement/enforce';
import {
  findAttachmentsMeta,
  ZFindAttachmentsRequestSchema,
  ZFindAttachmentsResponseSchema,
} from './find-attachments.types';

export const findAttachmentsRoute = maybeAuthenticatedProcedure
  .meta(findAttachmentsMeta)
  .input(ZFindAttachmentsRequestSchema)
  .output(ZFindAttachmentsResponseSchema)
  // Mirrors the handler's own branch: with a token the call is
  // token-authorized, without one it asserts against the envelope's
  // organisation.
  .use(twoFactorScope((input) => (input.token ? TWO_FACTOR_SKIP : { envelope: input.envelopeId })))
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
