import { z } from 'zod';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createTemplateDirectLink } from '@documenso/lib/server-only/template/create-template-direct-link';
import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import { TemplateDirectLinkSchema } from '@documenso/prisma/generated/zod';

import { authenticatedProcedure } from '../trpc';

export const ZCreateTemplateDirectLinkRequestSchema = z.object({
  templateId: z.number().min(1),
  teamId: z.number().optional(),
  directRecipientId: z.number().min(1).optional(),
});

export const ZCreateTemplateDirectLinkResponseSchema = TemplateDirectLinkSchema;

export const createTemplateDirectLinkRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/template/{templateId}/direct/create',
      summary: 'Create direct link',
      description: 'Create a direct link for a template',
      tags: ['Template'],
    },
  })
  .input(ZCreateTemplateDirectLinkRequestSchema)
  .output(ZCreateTemplateDirectLinkResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { templateId, teamId, directRecipientId } = input;

    const userId = ctx.user.id;

    const template = await getTemplateById({ id: templateId, teamId, userId: ctx.user.id });

    const limits = await getServerLimits({ email: ctx.user.email, teamId: template.teamId });

    if (limits.remaining.directTemplates === 0) {
      throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
        message: 'You have reached your direct templates limit.',
      });
    }

    return await createTemplateDirectLink({ userId, templateId, directRecipientId });
  });
