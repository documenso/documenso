import { sValidator } from '@hono/standard-validator';
import type { DocumentData, EnvelopeItem } from '@prisma/client';
import { type Context, Hono } from 'hono';
import { z } from 'zod';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { PDF_IMAGE_RENDER_SCALE } from '@documenso/lib/constants/pdf-viewer';
import { pdfToImage } from '@documenso/lib/server-only/ai/pdf-to-images';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import type { DocumentDataVersion } from '@documenso/lib/types/document-data';
import { sha256 } from '@documenso/lib/universal/crypto';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { UNSAFE_getS3File } from '@documenso/lib/universal/upload/server-actions';
import { getEnvelopeItemPageImageS3Key } from '@documenso/lib/utils/envelope-images';
import { prisma } from '@documenso/prisma';

import type { HonoEnv } from '../../../router';

const route = new Hono<HonoEnv>();

const ZGetEnvelopeItemPageRequestParamsSchema = z.object({
  envelopeId: z.string().min(1),
  envelopeItemId: z.string().min(1),
  documentDataId: z.string().min(1),
  version: z.enum(['initial', 'current']),
  pageIndex: z.coerce.number().int().min(0),
});

const ZGetEnvelopeItemPageRequestQuerySchema = z.object({
  presignToken: z.string().optional(),
});

/**
 * Returns a single PDF page as a JPEG image.
 */
route.get(
  '/envelope/:envelopeId/envelopeItem/:envelopeItemId/dataId/:documentDataId/:version/:pageIndex/image.jpeg',
  sValidator('param', ZGetEnvelopeItemPageRequestParamsSchema),
  sValidator('query', ZGetEnvelopeItemPageRequestQuerySchema),
  async (c) => {
    const {
      envelopeId,
      envelopeItemId,
      documentDataId: _documentDataId,
      version,
      pageIndex,
    } = c.req.valid('param');

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

    const envelope = await prisma.envelope.findFirst({
      where: { id: envelopeId },
      include: {
        envelopeItems: {
          where: { id: envelopeItemId },
          include: { documentData: true },
        },
      },
    });

    if (!envelope) {
      return c.json({ error: 'Not found' }, 404);
    }

    const [envelopeItem] = envelope.envelopeItems;

    if (!envelopeItem?.documentData) {
      return c.json({ error: 'Not found' }, 404);
    }

    // Check team access
    const team = await getTeamById({
      userId,
      teamId: envelope.teamId,
    }).catch(() => null);

    if (!team) {
      return c.json({ error: 'Not found' }, 404);
    }

    return await handleEnvelopeItemPageRequest({
      c,
      envelopeItem,
      version,
      pageIndex,
    });
  },
);

type HandleEnvelopeItemPageRequestOptions = {
  c: Context<HonoEnv>;
  envelopeItem: EnvelopeItem & {
    documentData: DocumentData;
  };
  pageIndex: number;
  version: DocumentDataVersion;
};

export const handleEnvelopeItemPageRequest = async ({
  c,
  envelopeItem,
  pageIndex,
  version,
}: HandleEnvelopeItemPageRequestOptions) => {
  // Determine which PDF data to use based on version requested.
  const documentDataToUse =
    version === 'current' ? envelopeItem.documentData.data : envelopeItem.documentData.initialData;

  // Generate ETag from document data hash + page index.
  // Note: This can also be an S3 string.
  const etag = Buffer.from(sha256(`${documentDataToUse}:${pageIndex}`)).toString('hex');

  c.header('ETag', etag);

  if (c.req.header('If-None-Match') === etag) {
    return c.body(null, 304);
  }

  c.header('Content-Type', 'image/jpeg');

  // Return the image if it already exists in S3.
  if (envelopeItem.documentData.type === 'S3_PATH') {
    const s3Key = getEnvelopeItemPageImageS3Key(documentDataToUse, pageIndex);

    const image = await UNSAFE_getS3File(s3Key);

    if (image) {
      return c.body(image);
    }
  }

  // Fetch PDF to render the page on the spot if it doesn't exist in S3.
  const pdfBytes = await getFileServerSide({
    type: envelopeItem.documentData.type,
    data: documentDataToUse,
  });

  // Render page to image.
  const { image } = await pdfToImage(pdfBytes, {
    scale: PDF_IMAGE_RENDER_SCALE,
    pageIndex,
  }).catch((err) => {
    console.error(err);

    return {
      image: null,
    };
  });

  if (!image) {
    return c.json({ error: 'Failed to render page to image' }, 500);
  }

  return c.body(image);
};

export default route;
