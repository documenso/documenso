import { z } from 'zod';

import { deleteTemplateDirectLink } from '@documenso/lib/server-only/template/delete-template-direct-link';
import { TemplateDirectLinkSchema } from '@documenso/prisma/generated/zod';

import { authenticatedProcedure } from '../trpc';

export const ZDeleteTemplateDirectLinkRequestSchema = z.object({
  templateId: z.number().min(1),
});

export const ZDeleteTemplateDirectLinkResponseSchema = TemplateDirectLinkSchema;

export const deleteTemplateDirectLinkRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/template/{templateId}/direct/delete',
      summary: 'Delete direct link',
      description: 'Delete a direct link for a template',
      tags: ['Template'],
    },
  })
  .input(ZDeleteTemplateDirectLinkResponseSchema)
  .output(z.void())
  .mutation(async ({ input, ctx }) => {
    const { templateId } = input;

    const userId = ctx.user.id;

    await deleteTemplateDirectLink({ userId, templateId });
  });
