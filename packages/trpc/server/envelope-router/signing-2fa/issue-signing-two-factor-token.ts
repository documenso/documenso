import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getApiTokenByToken } from '@documenso/lib/server-only/public-api/get-api-token-by-token';
import { issueSigningTwoFactorToken } from '@documenso/lib/server-only/signing-2fa/issue-signing-two-factor-token';

import { authenticatedProcedure } from '../../trpc';
import {
  ZIssueSigningTwoFactorTokenRequestSchema,
  ZIssueSigningTwoFactorTokenResponseSchema,
  issueSigningTwoFactorTokenMeta,
} from './issue-signing-two-factor-token.types';

export const issueSigningTwoFactorTokenRoute = authenticatedProcedure
  .meta(issueSigningTwoFactorTokenMeta)
  .input(ZIssueSigningTwoFactorTokenRequestSchema)
  .output(ZIssueSigningTwoFactorTokenResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { envelopeId, recipientId } = input;

    ctx.logger.info({
      input: {
        envelopeId,
        recipientId,
      },
    });

    const authorizationHeader = ctx.req.headers.get('authorization');

    if (!authorizationHeader) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'API token required to issue signing 2FA tokens',
        statusCode: 401,
      });
    }

    const [token] = (authorizationHeader || '').split('Bearer ').filter((s) => s.length > 0);

    if (!token) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'API token required to issue signing 2FA tokens',
        statusCode: 401,
      });
    }

    const apiToken = await getApiTokenByToken({ token });

    const result = await issueSigningTwoFactorToken({
      recipientId,
      envelopeId,
      apiTokenId: apiToken.id,
    });

    return result;
  });
