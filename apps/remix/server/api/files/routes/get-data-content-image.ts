import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { DataContentType } from '@documenso/lib/types/data-content-meta';
import { sha256 } from '@documenso/lib/universal/crypto';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { prisma } from '@documenso/prisma';
import { sValidator } from '@hono/standard-validator';
import type { DataContent } from '@prisma/client';
import { type Context, Hono } from 'hono';
import { z } from 'zod';

import type { HonoEnv } from '../../../router';
import { checkEnvelopeFileAccess } from '../files.helpers';

const route = new Hono<HonoEnv>();

const ZGetDataContentImageRequestParamsSchema = z.object({
  envelopeId: z.string().min(1),
  dataContentId: z.string().min(1),
});

const ZGetDataContentImageRequestQuerySchema = z.object({
  presignToken: z.string().optional(),
});

/**
 * Returns the image of a data content attached to a content of the envelope.
 */
route.get(
  '/envelope/:envelopeId/dataContent/:dataContentId/image',
  sValidator('param', ZGetDataContentImageRequestParamsSchema),
  sValidator('query', ZGetDataContentImageRequestQuerySchema),
  async (c) => {
    const { envelopeId, dataContentId } = c.req.valid('param');

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

    const envelopeContent = await prisma.envelopeContent.findFirst({
      where: {
        envelopeId,
        dataContentId,
      },
      include: {
        dataContent: true,
        envelope: {
          select: {
            teamId: true,
            type: true,
            templateType: true,
          },
        },
      },
    });

    if (!envelopeContent?.dataContent) {
      return c.json({ error: 'Not found' }, 404);
    }

    const { dataContent, envelope } = envelopeContent;

    // Check whether the user has access to this content via the envelope.
    const hasAccess = await checkEnvelopeFileAccess({
      userId,
      teamId: envelope.teamId,
      envelopeType: envelope.type,
      templateType: envelope.templateType,
    });

    if (!hasAccess) {
      return c.json({ error: 'Not found' }, 404);
    }

    return await handleDataContentImageRequest({
      c,
      dataContent,
      cacheStrategy: 'private',
    });
  },
);

type HandleDataContentImageRequestOptions = {
  c: Context<HonoEnv>;
  dataContent: DataContent;

  /**
   * The type of cache strategy to use.
   *
   * For access via tokens, we can use a public cache to allow the CDN to cache it.
   *
   * For access via session, we must use a private cache.
   */
  cacheStrategy: 'private' | 'public';
};

/**
 * Serve the bytes of an image data content.
 *
 * Data contents are immutable, so the response is hard cached like envelope
 * item PDFs. The content type comes from the stored metadata and is never
 * sniffed from the bytes.
 */
export const handleDataContentImageRequest = async ({
  c,
  dataContent,
  cacheStrategy,
}: HandleDataContentImageRequestOptions) => {
  if (dataContent.metadata.type !== DataContentType.IMAGE) {
    return c.json({ error: 'Not found' }, 404);
  }

  const etag = Buffer.from(sha256(dataContent.data)).toString('hex');

  if (c.req.header('If-None-Match') === etag) {
    return c.body(null, 304);
  }

  const file = await getFileServerSide({
    type: dataContent.type,
    data: dataContent.data,
  }).catch((error) => {
    console.error(error);

    return null;
  });

  if (!file) {
    return c.json({ error: 'Not found' }, 404);
  }

  // Note: Only set these headers on success.
  c.header('Content-Type', dataContent.metadata.mimeType);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('ETag', etag);
  c.header('Cache-Control', `${cacheStrategy}, max-age=31536000, immutable`);

  return c.body(file);
};

export default route;
