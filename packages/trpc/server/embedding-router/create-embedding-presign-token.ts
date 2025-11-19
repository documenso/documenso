import { IS_BILLING_ENABLED } from '@doku-seal/lib/constants/app';
import { AppError, AppErrorCode } from '@doku-seal/lib/errors/app-error';
import { createEmbeddingPresignToken } from '@doku-seal/lib/server-only/embedding-presign/create-embedding-presign-token';
import { getOrganisationClaimByTeamId } from '@doku-seal/lib/server-only/organisation/get-organisation-claims';
import { getApiTokenByToken } from '@doku-seal/lib/server-only/public-api/get-api-token-by-token';

import { procedure } from '../trpc';
import {
  ZCreateEmbeddingPresignTokenRequestSchema,
  ZCreateEmbeddingPresignTokenResponseSchema,
  createEmbeddingPresignTokenMeta,
} from './create-embedding-presign-token.types';

/**
 * Route to create embedding presign tokens.
 */
export const createEmbeddingPresignTokenRoute = procedure
  .meta(createEmbeddingPresignTokenMeta)
  .input(ZCreateEmbeddingPresignTokenRequestSchema)
  .output(ZCreateEmbeddingPresignTokenResponseSchema)
  .mutation(async ({ input, ctx: { req } }) => {
    try {
      const authorizationHeader = req.headers.get('authorization');
      const [apiToken] = (authorizationHeader || '').split('Bearer ').filter((s) => s.length > 0);

      if (!apiToken) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'No API token provided',
        });
      }

      const { expiresIn } = input;

      if (IS_BILLING_ENABLED()) {
        const token = await getApiTokenByToken({ token: apiToken });

        if (!token.userId) {
          throw new AppError(AppErrorCode.UNAUTHORIZED, {
            message: 'Invalid API token',
          });
        }

        const organisationClaim = await getOrganisationClaimByTeamId({
          teamId: token.teamId,
        });

        if (!organisationClaim.flags.embedAuthoring) {
          throw new AppError(AppErrorCode.UNAUTHORIZED, {
            message: 'You do not have permission to create embedding presign tokens',
          });
        }
      }

      const presignToken = await createEmbeddingPresignToken({
        apiToken,
        expiresIn,
      });

      return { ...presignToken };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to create embedding presign token',
      });
    }
  });
