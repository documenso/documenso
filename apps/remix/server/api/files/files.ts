import { sValidator } from '@hono/standard-validator';
import { DocumentStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { Hono } from 'hono';
import type { Context } from 'hono';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { qrShareViewRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { sha256 } from '@documenso/lib/universal/crypto';
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

const isQrSharingEnabledForEnvelopeItem = (envelopeItem: {
  envelope: {
    team: {
      teamGlobalSettings: {
        allowPublicCompletedDocumentAccess: boolean | null;
      } | null;
      organisation: {
        organisationGlobalSettings: {
          allowPublicCompletedDocumentAccess: boolean;
        };
      };
    } | null;
  };
}) => {
  const team = envelopeItem.envelope.team;

  if (!team) {
    return true;
  }

  return (
    team.teamGlobalSettings?.allowPublicCompletedDocumentAccess ??
    team.organisation.organisationGlobalSettings.allowPublicCompletedDocumentAccess
  );
};

const maybeApplyQrRateLimit = async ({ c, token }: { c: Context<HonoEnv>; token: string }) => {
  let ip = 'unknown';

  try {
    ip = getIpAddress(c.req.raw);
  } catch {
    ip = 'unknown';
  }

  const tokenFingerprint = Buffer.from(sha256(token)).toString('hex').slice(0, 16);
  const result = await qrShareViewRateLimit.check({
    ip,
    identifier: tokenFingerprint,
  });

  c.header('X-RateLimit-Limit', String(result.limit));
  c.header('X-RateLimit-Remaining', String(result.remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(result.reset.getTime() / 1000)));

  if (!result.isLimited) {
    return null;
  }

  c.header(
    'Retry-After',
    String(Math.max(1, Math.ceil((result.reset.getTime() - Date.now()) / 1000))),
  );

  return c.json({ error: 'Too many requests, please try again later.' }, 429);
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
      const isQrToken = token.startsWith('qr_');

      if (isQrToken) {
        const rateLimitResponse = await maybeApplyQrRateLimit({ c, token });

        if (rateLimitResponse) {
          return rateLimitResponse;
        }
      }

      let envelopeWhereQuery: Prisma.EnvelopeItemWhereUniqueInput = {
        id: envelopeItemId,
        envelope: {
          recipients: {
            some: {
              token,
            },
          },
        },
      };

      if (isQrToken) {
        envelopeWhereQuery = {
          id: envelopeItemId,
          envelope: {
            qrToken: token,
            status: DocumentStatus.COMPLETED,
          },
        };
      }

      const envelopeItem = await prisma.envelopeItem.findUnique({
        where: envelopeWhereQuery,
        include: {
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
        },
      });

      if (!envelopeItem) {
        return c.json({ error: 'Envelope item not found' }, 404);
      }

      if (isQrToken && !isQrSharingEnabledForEnvelopeItem(envelopeItem)) {
        return c.json(
          { error: 'Public completed-document access is disabled for this document' },
          403,
        );
      }

      if (!envelopeItem.documentData) {
        return c.json({ error: 'Document data not found' }, 404);
      }

      return await handleEnvelopeItemFileRequest({
        title: envelopeItem.title,
        status: envelopeItem.envelope.status,
        documentData: envelopeItem.documentData,
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
      const isQrToken = token.startsWith('qr_');
      const effectiveVersion = isQrToken ? 'signed' : version;

      if (isQrToken) {
        const rateLimitResponse = await maybeApplyQrRateLimit({ c, token });

        if (rateLimitResponse) {
          return rateLimitResponse;
        }
      }

      let envelopeWhereQuery: Prisma.EnvelopeItemWhereUniqueInput = {
        id: envelopeItemId,
        envelope: {
          recipients: {
            some: {
              token,
            },
          },
        },
      };

      if (isQrToken) {
        envelopeWhereQuery = {
          id: envelopeItemId,
          envelope: {
            qrToken: token,
            status: DocumentStatus.COMPLETED,
          },
        };
      }

      const envelopeItem = await prisma.envelopeItem.findUnique({
        where: envelopeWhereQuery,
        include: {
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
        },
      });

      if (!envelopeItem) {
        return c.json({ error: 'Envelope item not found' }, 404);
      }

      if (isQrToken && !isQrSharingEnabledForEnvelopeItem(envelopeItem)) {
        return c.json(
          { error: 'Public completed-document access is disabled for this document' },
          403,
        );
      }

      if (!envelopeItem.documentData) {
        return c.json({ error: 'Document data not found' }, 404);
      }

      return await handleEnvelopeItemFileRequest({
        title: envelopeItem.title,
        status: envelopeItem.envelope.status,
        documentData: envelopeItem.documentData,
        version: effectiveVersion,
        isDownload: true,
        context: c,
      });
    },
  );
