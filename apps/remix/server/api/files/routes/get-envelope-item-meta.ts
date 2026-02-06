import { sValidator } from '@hono/standard-validator';
import type { DocumentData, EnvelopeItem } from '@prisma/client';
import { type Context, Hono } from 'hono';
import { z } from 'zod';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import type { TDocumentDataMeta } from '@documenso/lib/types/document-data';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { extractAndStorePdfImages } from '@documenso/lib/universal/upload/put-file.server';
import { prisma } from '@documenso/prisma';

import type { HonoEnv } from '../../../router';
import type { TGetEnvelopeItemsMetaResponse } from '../files.types';

const route = new Hono<HonoEnv>();

const ZGetEnvelopeMetaParamsSchema = z.object({
  envelopeId: z.string().min(1),
});

const ZGetEnvelopeMetaQuerySchema = z.object({
  presignToken: z.string().optional(),
});

/**
 * Returns metadata for all envelope items including page counts and dimensions.
 */
route.get(
  '/envelope/:envelopeId/meta',
  sValidator('param', ZGetEnvelopeMetaParamsSchema),
  sValidator('query', ZGetEnvelopeMetaQuerySchema),
  async (c) => {
    const { envelopeId } = c.req.valid('param');
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

    // Note: Access is verified in the getTeamById call after this.
    const envelope = await prisma.envelope.findFirst({
      where: {
        id: envelopeId,
      },
      include: {
        envelopeItems: {
          include: { documentData: true },
        },
      },
    });

    if (!envelope) {
      return c.json({ error: 'Not found' }, 404);
    }

    // Check access to envelope.
    const team = await getTeamById({
      userId,
      teamId: envelope.teamId,
    }).catch(() => null);

    if (!team) {
      return c.json({ error: 'Not found' }, 404);
    }

    return await handleEnvelopeItemsMetaRequest({
      c,
      envelopeItems: envelope.envelopeItems,
    });
  },
);

type HandleEnvelopeItemsMetaRequestOptions = {
  c: Context<HonoEnv>;
  envelopeItems: (EnvelopeItem & {
    documentData: DocumentData;
  })[];
};

export const handleEnvelopeItemsMetaRequest = async ({
  c,
  envelopeItems,
}: HandleEnvelopeItemsMetaRequestOptions) => {
  const response = await Promise.all(
    envelopeItems.map(async (item) => {
      let pageMetadata = item.documentData.metadata;

      // Runtime backfill if pageMetadata is missing.
      if (!pageMetadata) {
        const pdfBytes = await getFileServerSide({
          type: item.documentData.type,
          data: item.documentData.data,
        });

        const pdfPageMetadata: TDocumentDataMeta['pages'] = await extractAndStorePdfImages(
          new Uint8Array(pdfBytes).buffer,
          item.documentData.id,
        );

        pageMetadata = {
          pages: pdfPageMetadata,
        };
      }

      const pages = pageMetadata.pages ?? [];

      return {
        envelopeItemId: item.id,
        documentDataId: item.documentData.id,
        pages: pages.map((page) => ({
          originalWidth: page.originalWidth,
          originalHeight: page.originalHeight,
          scale: page.scale,
          scaledWidth: page.scaledWidth,
          scaledHeight: page.scaledHeight,
        })),
      };
    }),
  );

  return c.json({ envelopeItems: response } satisfies TGetEnvelopeItemsMetaResponse);
};

export default route;
