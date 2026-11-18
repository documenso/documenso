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

route.get(
  '/token/:token/envelope/:envelopeId/dataContent/:dataContentId/image',
  sValidator('param', ZGetDataContentImageByTokenParamsSchema),
  async (c) => {
    const { token, envelopeId, dataContentId } = c.req.valid('param');

    if (!token) {
      return c.json({ error: 'Not found' }, 404);
    }

    let envelopeWhereQuery: Prisma.EnvelopeWhereInput = {
      id: envelopeId,
      recipients: {
        some: {
          token,
        },
      },
    };

    if (token.startsWith('qr_')) {
      envelopeWhereQuery = {
        id: envelopeId,
        qrToken: token,
      };
    }

    // The token must grant access to the envelope the data content is attached to.
    const envelopeContent = await prisma.envelopeContent.findFirst({
      where: {
        envelopeId,
        dataContentId,
        envelope: envelopeWhereQuery,
      },
      include: {
        dataContent: true,
      },
    });

    if (!envelopeContent?.dataContent) {
      return c.json({ error: 'Not found' }, 404);
    }

    return await handleDataContentImageRequest({
      c,
      dataContent: envelopeContent.dataContent,
      cacheStrategy: 'private',
    });
  },
);

export default route;
