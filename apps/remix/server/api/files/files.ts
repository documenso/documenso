import { sValidator } from '@hono/standard-validator';
import { DocumentStatus, type Prisma } from '@prisma/client';
import { type Context, Hono } from 'hono';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { rateLimitResponse } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { qrShareViewRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { tokenFingerprint } from '@documenso/lib/universal/crypto';
import { isPublicDocumentAccessEnabled } from '@documenso/lib/universal/document-access';
import { getIpAddress } from '@documenso/lib/universal/get-ip-address';
import { putNormalizedPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { getPresignPostUrl } from '@documenso/lib/universal/upload/server-actions';
import { prisma } from '@documenso/prisma';

import type { HonoEnv } from '../../router';
import { handleEnvelopeItemFileRequest } from './files.helpers';
import {
  type TGetPresignedPostUrlResponse,
  ZGetEnvelopeItemFileDownloadRequestParamsSchema,
  ZGetEnvelopeItemFileRequestParamsSchema,
  ZGetEnvelopeItemFileRequestQuerySchema,
  ZGetEnvelopeItemFileTokenDownloadRequestParamsSchema,
  ZGetEnvelopeItemFileTokenRequestParamsSchema,
  ZGetPresignedPostUrlRequestSchema,
  ZUploadPdfRequestSchema,
} from './files.types';

const envelopeItemTokenInclude = {
  envelope: {
    include: {
      team: {
        include: {
          teamGlobalSettings: {
            select: {
              allowPublicCompletedDocumentAccess: true,
            },
          },
          organisation: {
            include: {
              organisationGlobalSettings: {
                select: {
                  allowPublicCompletedDocumentAccess: true,
                },
              },
            },
          },
        },
      },
    },
  },
  documentData: true,
} as const;

const maybeApplyQrRateLimit = async (c: Context<HonoEnv>, token: string) => {
  let ip: string;

  try {
    ip = getIpAddress(c.req.raw);
  } catch {
    ip = 'unknown';
  }

  const result = await qrShareViewRateLimit.check({
    ip,
    identifier: tokenFingerprint(token),
  });

  return rateLimitResponse(c, result);
};

const getEnvelopeItemByToken = async (
  c: Context<HonoEnv>,
  token: string,
  envelopeItemId: string,
) => {
  const isQrToken = token.startsWith('qr_');

  if (isQrToken) {
    const limited = await maybeApplyQrRateLimit(c, token);

    if (limited) {
      return { limited } as const;
    }
  }

  const envelopeWhereQuery: Prisma.EnvelopeItemWhereUniqueInput = isQrToken
    ? {
        id: envelopeItemId,
        envelope: {
          qrToken: token,
          status: DocumentStatus.COMPLETED,
        },
      }
    : {
        id: envelopeItemId,
        envelope: {
          recipients: {
            some: {
              token,
            },
          },
        },
      };

  const envelopeItem = await prisma.envelopeItem.findUnique({
    where: envelopeWhereQuery,
    include: envelopeItemTokenInclude,
  });

  if (!envelopeItem) {
    return { error: c.json({ error: 'Envelope item not found' }, 404) } as const;
  }

  if (isQrToken && !isPublicDocumentAccessEnabled(envelopeItem.envelope.team)) {
    return {
      error: c.json(
        { error: 'Public completed-document access is disabled for this document' },
        403,
      ),
    } as const;
  }

  if (!envelopeItem.documentData) {
    return { error: c.json({ error: 'Document data not found' }, 404) } as const;
  }

  return { envelopeItem, isQrToken } as const;
};

export const filesRoute = new Hono<HonoEnv>()
  /**
   * Uploads a document file to the appropriate storage location and creates
   * a document data record.
   */
  .post('/upload-pdf', sValidator('form', ZUploadPdfRequestSchema), async (c) => {
    try {
      const { file } = c.req.valid('form');

      if (!file) {
        return c.json({ error: 'No file provided' }, 400);
      }

      // Todo: (RR7) This is new.
      // Add file size validation.
      // Convert MB to bytes (1 MB = 1024 * 1024 bytes)
      const MAX_FILE_SIZE = APP_DOCUMENT_UPLOAD_SIZE_LIMIT * 1024 * 1024;

      if (file.size > MAX_FILE_SIZE) {
        return c.json({ error: 'File too large' }, 400);
      }

      const result = await putNormalizedPdfFileServerSide(file);

      return c.json(result);
    } catch (error) {
      console.error('Upload failed:', error);
      return c.json({ error: 'Upload failed' }, 500);
    }
  })
  .post('/presigned-post-url', sValidator('json', ZGetPresignedPostUrlRequestSchema), async (c) => {
    const { fileName, contentType } = c.req.valid('json');

    try {
      const { key, url } = await getPresignPostUrl(fileName, contentType);

      return c.json({ key, url } satisfies TGetPresignedPostUrlResponse);
    } catch (err) {
      console.error(err);

      throw new AppError(AppErrorCode.UNKNOWN_ERROR);
    }
  })
  .get(
    '/envelope/:envelopeId/envelopeItem/:envelopeItemId',
    sValidator('param', ZGetEnvelopeItemFileRequestParamsSchema),
    sValidator('query', ZGetEnvelopeItemFileRequestQuerySchema),
    async (c) => {
      const { envelopeId, envelopeItemId } = c.req.valid('param');
      const { token } = c.req.query();

      const session = await getOptionalSession(c);

      let userId = session.user?.id;

      if (token) {
        const presignToken = await verifyEmbeddingPresignToken({
          token,
        }).catch(() => undefined);

        userId = presignToken?.userId;
      }

      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const envelope = await prisma.envelope.findFirst({
        where: {
          id: envelopeId,
        },
        include: {
          envelopeItems: {
            where: {
              id: envelopeItemId,
            },
            include: {
              documentData: true,
            },
          },
        },
      });

      if (!envelope) {
        return c.json({ error: 'Envelope not found' }, 404);
      }

      const [envelopeItem] = envelope.envelopeItems;

      if (!envelopeItem) {
        return c.json({ error: 'Envelope item not found' }, 404);
      }

      const team = await getTeamById({
        userId: userId,
        teamId: envelope.teamId,
      }).catch((error) => {
        console.error(error);

        return null;
      });

      if (!team) {
        return c.json(
          { error: 'User does not have access to the team that this envelope is associated with' },
          403,
        );
      }

      if (!envelopeItem.documentData) {
        return c.json({ error: 'Document data not found' }, 404);
      }

      return await handleEnvelopeItemFileRequest({
        title: envelopeItem.title,
        status: envelope.status,
        documentData: envelopeItem.documentData,
        version: 'signed',
        isDownload: false,
        context: c,
      });
    },
  )
  .get(
    '/envelope/:envelopeId/envelopeItem/:envelopeItemId/download/:version?',
    sValidator('param', ZGetEnvelopeItemFileDownloadRequestParamsSchema),
    async (c) => {
      const { envelopeId, envelopeItemId, version } = c.req.valid('param');

      const session = await getOptionalSession(c);

      if (!session.user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const envelope = await prisma.envelope.findFirst({
        where: {
          id: envelopeId,
        },
        include: {
          envelopeItems: {
            where: {
              id: envelopeItemId,
            },
            include: {
              documentData: true,
            },
          },
        },
      });

      if (!envelope) {
        return c.json({ error: 'Envelope not found' }, 404);
      }

      const [envelopeItem] = envelope.envelopeItems;

      if (!envelopeItem) {
        return c.json({ error: 'Envelope item not found' }, 404);
      }

      const team = await getTeamById({
        userId: session.user.id,
        teamId: envelope.teamId,
      }).catch((error) => {
        console.error(error);

        return null;
      });

      if (!team) {
        return c.json(
          { error: 'User does not have access to the team that this envelope is associated with' },
          403,
        );
      }

      if (!envelopeItem.documentData) {
        return c.json({ error: 'Document data not found' }, 404);
      }

      return await handleEnvelopeItemFileRequest({
        title: envelopeItem.title,
        status: envelope.status,
        documentData: envelopeItem.documentData,
        version,
        isDownload: true,
        context: c,
      });
    },
  )
  .get(
    '/token/:token/envelopeItem/:envelopeItemId',
    sValidator('param', ZGetEnvelopeItemFileTokenRequestParamsSchema),
    async (c) => {
      const { token, envelopeItemId } = c.req.valid('param');

      const result = await getEnvelopeItemByToken(c, token, envelopeItemId);

      if ('limited' in result) {
        return result.limited;
      }

      if ('error' in result) {
        return result.error;
      }

      return await handleEnvelopeItemFileRequest({
        title: result.envelopeItem.title,
        status: result.envelopeItem.envelope.status,
        documentData: result.envelopeItem.documentData!,
        version: 'signed',
        isDownload: false,
        context: c,
      });
    },
  )
  .get(
    '/token/:token/envelopeItem/:envelopeItemId/download/:version?',
    sValidator('param', ZGetEnvelopeItemFileTokenDownloadRequestParamsSchema),
    async (c) => {
      const { token, envelopeItemId, version } = c.req.valid('param');

      const result = await getEnvelopeItemByToken(c, token, envelopeItemId);

      if ('limited' in result) {
        return result.limited;
      }

      if ('error' in result) {
        return result.error;
      }

      const effectiveVersion = result.isQrToken ? 'signed' : version;

      return await handleEnvelopeItemFileRequest({
        title: result.envelopeItem.title,
        status: result.envelopeItem.envelope.status,
        documentData: result.envelopeItem.documentData!,
        version: effectiveVersion,
        isDownload: true,
        context: c,
      });
    },
  );
