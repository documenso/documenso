import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import { updateTemplateSettings } from '@documenso/lib/server-only/template/update-template-settings';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { authenticatedProcedure } from '../trpc';

export const ZUpdateTemplateTypedSignatureSettingsRequestSchema = z.object({
  templateId: z.number(),
  teamId: z.number().optional(),
  typedSignatureEnabled: z.boolean(),
});

export const updateTemplateTypedSignatureSettingsRoute = authenticatedProcedure
  .input(ZUpdateTemplateTypedSignatureSettingsRequestSchema)
  .mutation(async ({ input, ctx }) => {
    const { templateId, teamId, typedSignatureEnabled } = input;

    const template = await getTemplateById({
      id: templateId,
      userId: ctx.user.id,
      teamId,
    }).catch(() => null);

    if (!template) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Template not found',
      });
    }

    return await updateTemplateSettings({
      templateId,
      teamId,
      userId: ctx.user.id,
      data: {},
      meta: {
        typedSignatureEnabled,
      },
      requestMetadata: extractNextApiRequestMetadata(ctx.req),
    });
  });
