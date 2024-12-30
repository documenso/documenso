import { z } from 'zod';

import { toggleTemplateDirectLink } from '@documenso/lib/server-only/template/toggle-template-direct-link';
import { TemplateDirectLinkSchema } from '@documenso/prisma/generated/zod';

import { authenticatedProcedure } from '../trpc';

export const ZToggleTemplateDirectLinkRequestSchema = z.object({
  templateId: z.number().min(1),
  enabled: z.boolean(),
});

export const ZToggleTemplateDirectLinkResponseSchema = TemplateDirectLinkSchema;

export const toggleTemplateDirectLinkRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/template/{templateId}/direct/toggle',
      summary: 'Toggle direct link',
      description: 'Enable or disable a direct link for a template',
      tags: ['Template'],
    },
  })
  .input(ZToggleTemplateDirectLinkRequestSchema)
  .output(ZToggleTemplateDirectLinkResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { templateId, enabled } = input;

    const userId = ctx.user.id;

    return await toggleTemplateDirectLink({ userId, templateId, enabled });
  });
