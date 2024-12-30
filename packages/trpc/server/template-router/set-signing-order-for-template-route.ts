import { z } from 'zod';

import { updateTemplateSettings } from '@documenso/lib/server-only/template/update-template-settings';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { DocumentSigningOrder } from '@documenso/prisma/client';

import { authenticatedProcedure } from '../trpc';

export const ZSetSigningOrderForTemplateRequestSchema = z.object({
  templateId: z.number(),
  teamId: z.number().optional(),
  signingOrder: z.nativeEnum(DocumentSigningOrder),
});

export const setSigningOrderForTemplateRoute = authenticatedProcedure
  .input(ZSetSigningOrderForTemplateRequestSchema)
  .mutation(async ({ input, ctx }) => {
    const { templateId, teamId, signingOrder } = input;

    return await updateTemplateSettings({
      templateId,
      teamId,
      data: {},
      meta: { signingOrder },
      userId: ctx.user.id,
      requestMetadata: extractNextApiRequestMetadata(ctx.req),
    });
  });
