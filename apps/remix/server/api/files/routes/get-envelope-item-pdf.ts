import { sValidator } from '@hono/standard-validator';
import type { DocumentData, EnvelopeItem } from '@prisma/client';
import { type Context, Hono } from 'hono';
import { z } from 'zod';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import type { DocumentDataVersion } from '@documenso/lib/types/document';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { prisma } from '@documenso/prisma';

import type { HonoEnv } from '../../../router';

const route = new Hono<HonoEnv>();

const ZGetEnvelopeItemPdfRequestParamsSchema = z.object({
  envelopeId: z.string().min(1),
  envelopeItemId: z.string().min(1),
  documentDataId: z.string().min(1),
  version: z.enum(['initial', 'current']),
});

const ZGetEnvelopeItemPdfRequestQuerySchema = z.object({
  presignToken: z.string().optional(),
});

/**
 * Returns a PDF file for an envelope item.
 */
route.get(
  '/envelope/:envelopeId/envelopeItem/:envelopeItemId/dataId/:documentDataId/:version/item.pdf',
  sValidator('param', ZGetEnvelopeItemPdfRequestParamsSchema),
  sValidator('query', ZGetEnvelopeItemPdfRequestQuerySchema),
  async (c) => {
    const { envelopeId, envelopeItemId, documentDataId, version } = c.req.valid('param');

    const { presignToken } = c.req.valid('query');

    const session = await getOptionalSession(c);

    let userId = session.user?.id;

    // Check presignToken if provided
    if (presignToken) {
      const verifiedToken = await verifyEmbeddingPresignToken({
        token: presignToken,
      }).catch(() => undefined);

      userId = verifiedToken?.userId;
    }

    if (!userId) {
      return c.json({ error: 'Not found' }, 404);
    }

    // Note: We authenticate whether the user can access this in the `getTeamById` below.
    const envelopeItem = await prisma.envelopeItem.findFirst({
      where: {
        id: envelopeItemId,
        envelopeId,
        documentDataId,
      },
      include: {
        documentData: true,
        envelope: {
          select: {
            id: true,
            teamId: true,
          },
        },
      },
    });

    if (!envelopeItem) {
      return c.json({ error: 'Not found' }, 404);
    }

    // Check whether the user has access to the document.
    const team = await getTeamById({
      userId,
      teamId: envelopeItem.envelope.teamId,
    }).catch(() => null);

    if (!team) {
      return c.json({ error: 'Not found' }, 404);
    }

    return await handleEnvelopeItemPdfRequest({
      c,
      envelopeItem,
      version,
      cacheStrategy: 'private',
    });
  },
);

type HandleEnvelopeItemPdfRequestOptions = {
  c: Context<HonoEnv>;
  envelopeItem: EnvelopeItem & {
    documentData: DocumentData;
  };
  version: DocumentDataVersion;

  /**
   * The type of cache strategy to use.
   *
   * For access via tokens, we can use a public cache to allow the CDN to cache it.
   *
   * For access via session, we must use a private cache.
   */
  cacheStrategy: 'private' | 'public';
};

export const handleEnvelopeItemPdfRequest = async ({
  c,
  envelopeItem,
  version,
  cacheStrategy,
}: HandleEnvelopeItemPdfRequestOptions) => {
  // Determine which PDF data to use based on version requested.
  const documentDataToUse =
    version === 'current' ? envelopeItem.documentData.data : envelopeItem.documentData.initialData;

  const file = await getFileServerSide({
    type: envelopeItem.documentData.type,
    data: documentDataToUse,
  }).catch((error) => {
    console.error(error);

    return null;
  });

  if (!file) {
    return c.json({ error: 'Not found' }, 404);
  }

  // Note: Only set these headers on success.
  c.header('Content-Type', 'application/pdf');
  c.header('Cache-Control', `${cacheStrategy}, max-age=31536000, immutable`);

  return c.body(file);
};

export default route;
