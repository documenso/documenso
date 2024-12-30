import { z } from 'zod';

import { deleteTemplate } from '@documenso/lib/server-only/template/delete-template';
import { TemplateSchema } from '@documenso/prisma/generated/zod';

import { authenticatedProcedure } from '../trpc';
import { ZDeleteTemplateMutationSchema } from './schema';

export const ZDeleteTemplateRequestSchema = z.object({
  templateId: z.number().min(1),
  teamId: z.number().optional(),
});

export const ZDeleteTemplateResponseSchema = TemplateSchema;

export const deleteTemplateRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/template/{templateId}/delete',
      summary: 'Delete template',
      tags: ['Template'],
    },
  })
  .input(ZDeleteTemplateMutationSchema)
  .output(z.void())
  .mutation(async ({ input, ctx }) => {
    const { templateId, teamId } = input;

    const userId = ctx.user.id;

    await deleteTemplate({ userId, id: templateId, teamId });
  });
