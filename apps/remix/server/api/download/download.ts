import { PDF_SIZE_A4_72PPI } from '@documenso/lib/constants/pdf';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeById, getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { generateAuditLogPdf } from '@documenso/lib/server-only/pdf/generate-audit-log-pdf';
import { generateCertificatePdf } from '@documenso/lib/server-only/pdf/generate-certificate-pdf';
import { getApiTokenByToken } from '@documenso/lib/server-only/public-api/get-api-token-by-token';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import { sValidator } from '@hono/standard-validator';
import { DocumentStatus, EnvelopeType } from '@prisma/client';
import contentDisposition from 'content-disposition';
import { Hono } from 'hono';

import type { HonoEnv } from '../../router';
import { handleEnvelopeItemFileRequest } from '../files/files.helpers';
import {
  ZDownloadDocumentRequestParamsSchema,
  ZDownloadEnvelopeAuditLogPdfRequestParamsSchema,
  ZDownloadEnvelopeCertificatePdfRequestParamsSchema,
  ZDownloadEnvelopeItemRequestParamsSchema,
  ZDownloadEnvelopeItemRequestQuerySchema,
} from './download.types';

/**
 * Resolve and validate an API token from the Authorization header.
 *
 * Supports both "Authorization: Bearer api_xxx" and "Authorization: api_xxx".
 */
const resolveApiToken = async (authorizationHeader: string | undefined) => {
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

  return apiToken;
};

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

        const apiToken = await resolveApiToken(c.req.header('authorization'));

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
   * Download the audit log for a document as a PDF.
   * Requires API key authentication via Authorization header.
   */
  .get(
    '/envelope/:envelopeId/audit-log/download',
    sValidator('param', ZDownloadEnvelopeAuditLogPdfRequestParamsSchema),
    async (c) => {
      const logger = c.get('logger');

      try {
        const { envelopeId } = c.req.valid('param');

        const apiToken = await resolveApiToken(c.req.header('authorization'));

        logger.info({
          auth: 'api',
          source: 'apiV2',
          path: c.req.path,
          userId: apiToken.user.id,
          apiTokenId: apiToken.id,
          envelopeId,
        });

        const envelope = await getEnvelopeById({
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
          type: EnvelopeType.DOCUMENT,
          userId: apiToken.user.id,
          teamId: apiToken.teamId,
        }).catch(() => null);

        if (!envelope) {
          return c.json({ error: 'Document not found' }, 404);
        }

        const auditLogPdf = await generateAuditLogPdf({
          envelope,
          recipients: envelope.recipients,
          fields: envelope.fields,
          language: envelope.documentMeta.language,
          envelopeOwner: {
            email: envelope.user.email,
            name: envelope.user.name || '',
          },
          envelopeItems: envelope.envelopeItems.map((item) => item.title),
          pageWidth: PDF_SIZE_A4_72PPI.width,
          pageHeight: PDF_SIZE_A4_72PPI.height,
        });

        const result = await auditLogPdf.save();

        const baseTitle = envelope.title.replace(/\.pdf$/i, '');

        c.header('Content-Type', 'application/pdf');
        c.header('Content-Disposition', contentDisposition(`${baseTitle}_audit-log.pdf`));
        c.header('Cache-Control', 'no-cache, no-store, must-revalidate');

        return c.body(result);
      } catch (error) {
        logger.error(error);

        if (error instanceof AppError) {
          const { status, body } = AppError.toRestAPIError(error);

          return c.json({ error: body.message, code: error.code }, status);
        }

        return c.json({ error: 'Internal server error' }, 500);
      }
    },
  )
  /**
   * Download the signing certificate for a completed document as a PDF.
   * Requires API key authentication via Authorization header.
   */
  .get(
    '/envelope/:envelopeId/certificate/download',
    sValidator('param', ZDownloadEnvelopeCertificatePdfRequestParamsSchema),
    async (c) => {
      const logger = c.get('logger');

      try {
        const { envelopeId } = c.req.valid('param');

        const apiToken = await resolveApiToken(c.req.header('authorization'));

        logger.info({
          auth: 'api',
          source: 'apiV2',
          path: c.req.path,
          userId: apiToken.user.id,
          apiTokenId: apiToken.id,
          envelopeId,
        });

        const { envelopeWhereInput } = await getEnvelopeWhereInput({
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
          type: EnvelopeType.DOCUMENT,
          userId: apiToken.user.id,
          teamId: apiToken.teamId,
        });

        const envelope = await prisma.envelope.findFirst({
          where: envelopeWhereInput,
          include: {
            recipients: true,
            fields: {
              include: {
                signature: true,
              },
            },
            documentMeta: true,
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        });

        if (!envelope) {
          return c.json({ error: 'Document not found' }, 404);
        }

        // A cancelled document was never sealed/completed, so a signing certificate
        // must not be generated for it.
        if (!isDocumentCompleted(envelope.status) || envelope.status === DocumentStatus.CANCELLED) {
          throw new AppError('DOCUMENT_NOT_COMPLETE', {
            message: 'Document is not complete',
          });
        }

        const certificatePdf = await generateCertificatePdf({
          envelope,
          recipients: envelope.recipients,
          fields: envelope.fields,
          language: envelope.documentMeta.language,
          envelopeOwner: {
            email: envelope.user.email,
            name: envelope.user.name || '',
          },
          pageWidth: PDF_SIZE_A4_72PPI.width,
          pageHeight: PDF_SIZE_A4_72PPI.height,
        });

        const result = await certificatePdf.save();

        const baseTitle = envelope.title.replace(/\.pdf$/i, '');

        c.header('Content-Type', 'application/pdf');
        c.header('Content-Disposition', contentDisposition(`${baseTitle}_certificate.pdf`));
        c.header('Cache-Control', 'no-cache, no-store, must-revalidate');

        return c.body(result);
      } catch (error) {
        logger.error(error);

        if (error instanceof AppError) {
          const { status, body } = AppError.toRestAPIError(error);

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

      const apiToken = await resolveApiToken(c.req.header('authorization'));

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
        const { status, body } = AppError.toRestAPIError(error);

        return c.json({ error: body.message, code: error.code }, status);
      }

      return c.json({ error: 'Internal server error' }, 500);
    }
  });
