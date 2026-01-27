import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { prisma } from '@documenso/prisma';

import type { HonoEnv } from '../../../router';
import { handleEnvelopeItemsMetaRequest } from './get-envelope-item-meta';

const route = new Hono<HonoEnv>();

const ZGetEnvelopeMetaByTokenParamSchema = z.object({
  token: z.string().min(1),
  envelopeId: z.string().min(1),
});

/**
 * Returns metadata for all envelope items including page counts and dimensions using a token.
 */
route.get(
  '/token/:token/envelope/:envelopeId/meta',
  sValidator('param', ZGetEnvelopeMetaByTokenParamSchema),
  async (c) => {
    const { token, envelopeId } = c.req.valid('param');

    // Validate token belongs to envelope
    const recipient = await prisma.recipient.findFirst({
      where: {
        token,
        envelopeId,
      },
      select: {
        envelope: {
          include: {
            envelopeItems: {
              include: { documentData: true },
            },
          },
        },
      },
    });

    if (!recipient) {
      return c.json({ error: 'Not found' }, 404);
    }

    return await handleEnvelopeItemsMetaRequest({
      c,
      envelopeItems: recipient.envelope.envelopeItems,
    });
  },
);

export default route;
