import { sValidator } from '@hono/standard-validator';
import { DocumentStatus, SigningStatus } from '@prisma/client';
import { Hono } from 'hono';
import { z } from 'zod';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import type { HonoEnv } from '../../router';
import { handlePartialEnvelopeItemFileRequest } from '../files/files.helpers';

const ZSignEnvelopeItemDownloadParamsSchema = z.object({
  token: z.string().min(1),
  envelopeItemId: z.string().min(1),
});

const ZSignEnvelopeItemDownloadQuerySchema = z.object({
  version: z.literal('pending').optional().default('pending'),
});

export const signRoute = new Hono<HonoEnv>().get(
  '/sign/:token/envelope-item/:envelopeItemId/download',
  sValidator('param', ZSignEnvelopeItemDownloadParamsSchema),
  sValidator('query', ZSignEnvelopeItemDownloadQuerySchema),
  async (c) => {
    const logger = c.get('logger');

    try {
      const { token, envelopeItemId } = c.req.valid('param');
      const { version } = c.req.valid('query');

      const recipient = await prisma.recipient.findFirst({
        where: {
          token,
          envelope: {
            status: {
              not: DocumentStatus.DRAFT,
            },
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
              envelopeItems: {
                where: {
                  id: envelopeItemId,
                },
                include: {
                  documentData: true,
                },
              },
            },
          },
        },
      });

      const envelopeItem = recipient?.envelope.envelopeItems[0];

      if (!recipient || !envelopeItem) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Envelope item not found',
          statusCode: 404,
        });
      }

      if (
        recipient.signingStatus !== SigningStatus.SIGNED &&
        recipient.signingStatus !== SigningStatus.REJECTED
      ) {
        throw new AppError(AppErrorCode.FORBIDDEN, {
          message: 'Recipient must sign or reject before downloading a draft signed PDF',
          statusCode: 403,
        });
      }

      logger.info({
        auth: 'recipient-token',
        source: 'apiV2',
        path: c.req.path,
        recipientId: recipient.id,
        envelopeItemId,
        version,
      });

      return await handlePartialEnvelopeItemFileRequest({
        title: envelopeItem.title,
        envelopeItemId: envelopeItem.id,
        envelope: recipient.envelope,
        documentData: envelopeItem.documentData,
        context: c,
      });
    } catch (error) {
      logger.error(error);

      if (error instanceof AppError) {
        const { status } = AppError.toRestAPIError(error);

        return c.json(
          {
            code: error.code,
            message: error.message,
            status,
          },
          status,
        );
      }

      return c.json({ error: 'Internal server error' }, 500);
    }
  },
);
