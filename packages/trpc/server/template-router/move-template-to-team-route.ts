import { z } from 'zod';

import { moveTemplateToTeam } from '@documenso/lib/server-only/template/move-template-to-team';
import { TemplateSchema } from '@documenso/prisma/generated/zod';

import { authenticatedProcedure } from '../trpc';

export const ZMoveTemplateToTeamRequestSchema = z.object({
  templateId: z.number(),
  teamId: z.number(),
});

export const ZMoveTemplateToTeamResponseSchema = TemplateSchema;

export const moveTemplateToTeamRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/template/{templateId}/move',
      summary: 'Move template',
      description: 'Move a template to a team',
      tags: ['Template'],
    },
  })
  .input(ZMoveTemplateToTeamRequestSchema)
  .output(ZMoveTemplateToTeamResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { templateId, teamId } = input;
    const userId = ctx.user.id;

    return await moveTemplateToTeam({
      templateId,
      teamId,
      userId,
    });
  });
