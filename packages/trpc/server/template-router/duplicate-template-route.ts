import { z } from 'zod';

import { duplicateTemplate } from '@documenso/lib/server-only/template/duplicate-template';
import { TemplateSchema } from '@documenso/prisma/generated/zod';

import { authenticatedProcedure } from '../trpc';

export const ZDuplicateTemplateRequestSchema = z.object({
  templateId: z.number(),
  teamId: z.number().optional(),
});

export const ZDuplicateTemplateResponseSchema = TemplateSchema;

export const duplicateTemplateRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/template/{templateId}/duplicate',
      summary: 'Duplicate template',
      tags: ['Template'],
    },
  })
  .input(ZDuplicateTemplateRequestSchema)
  .output(ZDuplicateTemplateResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, templateId } = input;

    return await duplicateTemplate({
      userId: ctx.user.id,
      teamId,
      templateId,
    });
  });
