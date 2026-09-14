import { prisma } from '@documenso/prisma';
import { sValidator } from '@hono/standard-validator';
import type { Prisma } from '@prisma/client';
import { Hono } from 'hono';
import { z } from 'zod';

import type { HonoEnv } from '../../../router';
import { handleDataContentImageRequest } from './get-data-content-image';

const route = new Hono<HonoEnv>();

const ZGetDataContentImageByTokenParamsSchema = z.object({
  token: z.string().min(1),
  envelopeId: z.string().min(1),
  dataContentId: z.string().min(1),
});

/**
 * Returns the image of a data content attached to a content of the envelope,
 * using a recipient or QR token.
 */
route.get(
  '/token/:token/envelope/:envelopeId/dataContent/:dataContentId/image',
  sValidator('param', ZGetDataContentImageByTokenParamsSchema),
  async (c) => {
    const { token, envelopeId, dataContentId } = c.req.valid('param');

    // Recipient token based query.
    let envelopeWhereQuery: Prisma.EnvelopeWhereInput = {
      id: envelopeId,
      recipients: {
        some: {
          token,
        },
      },
    };

    // QR token based query.
    if (token.startsWith('qr_')) {
      envelopeWhereQuery = {
        id: envelopeId,
        qrToken: token,
      };
    }

    // Validate envelope access via the content the data content is attached to.
    const dataContent = await prisma.dataContent.findFirst({
      where: {
        id: dataContentId,
        envelopeContent: {
          envelope: envelopeWhereQuery,
        },
      },
    });

    if (!dataContent) {
      return c.json({ error: 'Not found' }, 404);
    }

    return await handleDataContentImageRequest({
      c,
      dataContent,
      cacheStrategy: 'private',
    });
  },
);

export default route;
