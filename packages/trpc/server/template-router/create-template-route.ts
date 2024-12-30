import { z } from 'zod';

import { createTemplate } from '@documenso/lib/server-only/template/create-template';
import { TemplateSchema } from '@documenso/prisma/generated/zod';

import { authenticatedProcedure } from '../trpc';

export const ZCreateTemplateRequestSchema = z.object({
  title: z.string().min(1).trim(),
  teamId: z.number().optional(),
  templateDocumentDataId: z.string().min(1),
});

export const ZCreateTemplateResponseSchema = TemplateSchema;

export const createTemplateRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/template/create',
      summary: 'Create template',
      description: 'Create a new template',
      tags: ['Template'],
    },
  })
  .input(ZCreateTemplateRequestSchema)
  .output(ZCreateTemplateResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, title, templateDocumentDataId } = input;

    return await createTemplate({
      userId: ctx.user.id,
      teamId,
      title,
      templateDocumentDataId,
    });
  });
