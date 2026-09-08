import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError } from '@documenso/lib/errors/app-error';
import { assertTwoFactorEnforcementForSession } from '@documenso/lib/server-only/2fa/org-enforcement';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import type { DocumentDataVersion } from '@documenso/lib/types/document';
import { sha256 } from '@documenso/lib/universal/crypto';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { prisma } from '@documenso/prisma';
import { sValidator } from '@hono/standard-validator';
import type { DocumentData, EnvelopeItem } from '@prisma/client';
import { type Context, Hono } from 'hono';
import { z } from 'zod';

import type { HonoEnv } from '../../../router';
import { checkEnvelopeFileAccess } from '../files.helpers';

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

    // Presign-token access (embedding) is machine access and exempt from 2FA
    // enforcement; the assert below only applies to session auth.
    const isPresignTokenAccess = Boolean(presignToken);

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
            type: true,
            teamId: true,
            templateType: true,
            team: {
              select: {
                organisationId: true,
              },
            },
          },
        },
      },
    });

    if (!envelopeItem) {
      return c.json({ error: 'Not found' }, 404);
    }

    // 2FA enforcement (session auth only): instance assert + the owning
    // organisation's policy for the envelope being accessed.
    if (!isPresignTokenAccess && session.user && session.session) {
      try {
        await assertTwoFactorEnforcementForSession({
          user: session.user,
          session: session.session,
          organisationIds: [envelopeItem.envelope.team.organisationId],
        });
      } catch (error) {
        if (error instanceof AppError) {
          const { status, body } = AppError.toRestAPIError(error);

          return c.json({ error: body.message, code: error.code }, status);
        }

        throw error;
      }
    }

    // Check whether the user has access to the document.
    const hasAccess = await checkEnvelopeFileAccess({
      userId,
      teamId: envelopeItem.envelope.teamId,
      envelopeType: envelopeItem.envelope.type,
      templateType: envelopeItem.envelope.templateType,
    });

    if (!hasAccess) {
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

  const etag = Buffer.from(sha256(documentDataToUse)).toString('hex');

  if (c.req.header('If-None-Match') === etag) {
    return c.status(304);
  }

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
  c.header('ETag', etag);
  c.header('Cache-Control', `${cacheStrategy}, max-age=31536000, immutable`);

  return c.body(file);
};

export default route;
