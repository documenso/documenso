import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { getApiTokenByToken } from '@documenso/lib/server-only/public-api/get-api-token-by-token';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import { sValidator } from '@hono/standard-validator';
import { EnvelopeType } from '@prisma/client';
import { Hono } from 'hono';

import type { HonoEnv } from '../../router';
import { handleEnvelopeItemFileRequest } from '../files/files.helpers';
import {
  ZDownloadDocumentRequestParamsSchema,
  ZDownloadEnvelopeItemRequestParamsSchema,
  ZDownloadEnvelopeItemRequestQuerySchema,
} from './download.types';

export const downloadRoute = new Hono<HonoEnv>()
  /**
   * Download an envelope item by its ID.
   * Requires API key authentication via Authorization header.
   */
  .get(
    '/envelope/item/:envelopeItemId/download',
    sValidator('param', ZDownloadEnvelopeItemRequestParamsSchema),
    sValidator('query', ZDownloadEnvelopeItemRequestQuerySchema),
    async (c) => {
      const logger = c.get('logger');

      try {
        const { envelopeItemId } = c.req.valid('param');
        const { version } = c.req.valid('query');
        const authorizationHeader = c.req.header('authorization');

        // Support for both "Authorization: Bearer api_xxx" and "Authorization: api_xxx"
        const [token] = (authorizationHeader || '').split('Bearer ').filter((s) => s.length > 0);

        if (!token) {
          throw new AppError(AppErrorCode.UNAUTHORIZED, {
            message: 'API token was not provided',
          });
        }

        const apiToken = await getApiTokenByToken({ token });

        if (apiToken.user.disabled) {
          throw new AppError(AppErrorCode.UNAUTHORIZED, {
            message: 'User is disabled',
          });
        }

        logger.info({
          auth: 'api',
          source: 'apiV2',
          path: c.req.path,
          userId: apiToken.user.id,
          apiTokenId: apiToken.id,
          envelopeItemId,
          version,
        });

        const envelopeItem = await prisma.envelopeItem.findFirst({
          where: {
            id: envelopeItemId,
            envelope: {
              team: buildTeamWhereQuery({ teamId: apiToken.teamId, userId: apiToken.user.id }),
            },
          },
          include: {
            envelope: {
              include: {
                recipients: {
                  select: {
                    role: true,
                    signingStatus: true,
                  },
                },
              },
            },
            documentData: true,
          },
        });

        if (!envelopeItem) {
          return c.json({ error: 'Envelope item not found' }, 404);
        }

        if (!envelopeItem.documentData) {
          return c.json({ error: 'Document data not found' }, 404);
        }

        const baseOptions = {
          title: envelopeItem.title,
          documentData: envelopeItem.documentData,
          isDownload: true,
          context: c,
        } as const;

        if (version === 'pending') {
          return await handleEnvelopeItemFileRequest({
            ...baseOptions,
            version,
            envelopeItemId: envelopeItem.id,
            envelope: envelopeItem.envelope,
          });
        }

        return await handleEnvelopeItemFileRequest({
          ...baseOptions,
          version,
          status: envelopeItem.envelope.status,
        });
      } catch (error) {
        logger.error(error);

        if (error instanceof AppError) {
          const { status, body } = AppError.toRestAPIError(error);

          // Preserve the existing `{ error }` shape for backwards compatibility;
          // `code` is added as a new field for callers that want to branch on it.
          return c.json({ error: body.message, code: error.code }, status);
        }

        return c.json({ error: 'Internal server error' }, 500);
      }
    },
  )
  /**
   * Download a document by its ID.
   * Requires API key authentication via Authorization header.
   */
  .get('/document/:documentId/download', sValidator('param', ZDownloadDocumentRequestParamsSchema), async (c) => {
    const logger = c.get('logger');

    try {
      const { documentId, version } = c.req.valid('param');
      const authorizationHeader = c.req.header('authorization');

      // Support for both "Authorization: Bearer api_xxx" and "Authorization: api_xxx"
      const [token] = (authorizationHeader || '').split('Bearer ').filter((s) => s.length > 0);

      if (!token) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'API token was not provided',
        });
      }

      const apiToken = await getApiTokenByToken({ token });

      if (apiToken.user.disabled) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'User is disabled',
        });
      }

      logger.info({
        auth: 'api',
        source: 'apiV2',
        path: c.req.path,
        userId: apiToken.user.id,
        apiTokenId: apiToken.id,
        documentId,
        version,
      });

      const envelope = await getEnvelopeById({
        id: {
          type: 'documentId',
          id: documentId,
        },
        type: EnvelopeType.DOCUMENT,
        userId: apiToken.user.id,
        teamId: apiToken.teamId,
      }).catch(() => null);

      if (!envelope) {
        return c.json({ error: 'Document not found' }, 404);
      }

      // Get the first envelope item (documents have exactly one)
      const [envelopeItem] = envelope.envelopeItems;

      if (!envelopeItem) {
        return c.json({ error: 'Document item not found' }, 404);
      }

      if (!envelopeItem.documentData) {
        return c.json({ error: 'Document data not found' }, 404);
      }

      return await handleEnvelopeItemFileRequest({
        title: envelopeItem.title,
        status: envelope.status,
        documentData: envelopeItem.documentData,
        version: version || 'signed',
        isDownload: true,
        context: c,
      });
    } catch (error) {
      logger.error(error);

      if (error instanceof AppError) {
        if (error.code === AppErrorCode.UNAUTHORIZED) {
          return c.json({ error: error.message }, 401);
        }

        return c.json({ error: error.message }, 400);
      }

      return c.json({ error: 'Internal server error' }, 500);
    }
  });
