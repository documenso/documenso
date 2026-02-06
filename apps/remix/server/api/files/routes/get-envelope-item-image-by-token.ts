import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { prisma } from '@documenso/prisma';

import type { HonoEnv } from '../../../router';
import { handleEnvelopeItemPageRequest } from './get-envelope-item-image';

const route = new Hono<HonoEnv>();

const ZGetEnvelopeItemPageTokenParamsSchema = z.object({
  token: z.string().min(1),
  envelopeId: z.string().min(1),
  envelopeItemId: z.string().min(1),
  documentDataId: z.string().min(1),
  version: z.enum(['initial', 'current']),
  pageIndex: z.coerce.number().int().min(0),
});

/**
 * Returns a single PDF page as a JPEG image using a token.
 */
route.get(
  '/token/:token/envelope/:envelopeId/envelopeItem/:envelopeItemId/dataId/:documentDataId/:version/:pageIndex/image.jpeg',
  sValidator('param', ZGetEnvelopeItemPageTokenParamsSchema),
  async (c) => {
    const { token, envelopeId, envelopeItemId, documentDataId, version, pageIndex } =
      c.req.valid('param');

    // Validate envelope access.
    const envelopeItem = await prisma.envelopeItem.findFirst({
      where: {
        id: envelopeItemId,
        documentDataId,
        envelope: {
          id: envelopeId,
          recipients: {
            some: {
              token,
            },
          },
        },
      },
      include: {
        documentData: true,
      },
    });

    if (!envelopeItem) {
      return c.json({ error: 'Not found' }, 404);
    }

    // We can hard cache this since since it's a unique URL for a given recipient.
    // Might be dicey if the handler returns a cacheable error code.
    c.header('Cache-Control', 'public, max-age=31536000, immutable');

    return await handleEnvelopeItemPageRequest({
      c,
      envelopeItem,
      version,
      pageIndex,
      cacheStrategy: 'public',
    });
  },
);

export default route;
