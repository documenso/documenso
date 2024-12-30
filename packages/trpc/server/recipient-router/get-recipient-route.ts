import { z } from 'zod';

import { getRecipientById } from '@documenso/lib/server-only/recipient/get-recipient-by-id';
import { FieldSchema, RecipientSchema } from '@documenso/prisma/generated/zod';

import { authenticatedProcedure } from '../trpc';

export const ZGetRecipientRequestSchema = z.object({
  recipientId: z.number(),
  teamId: z.number().optional(),
});

export const ZGetRecipientResponseSchema = RecipientSchema.extend({
  Field: FieldSchema.array(),
});

export const getRecipientRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'GET',
      path: '/recipient/{recipientId}',
      summary: 'Get recipient',
      description:
        'Returns a single recipient. If you want to retrieve all the recipients for a document or template, use the "Get Document" or "Get Template" request.',
      tags: ['Recipients'],
    },
  })
  .input(ZGetRecipientRequestSchema)
  .output(ZGetRecipientResponseSchema)
  .query(async ({ input, ctx }) => {
    const { recipientId, teamId } = input;

    return await getRecipientById({
      userId: ctx.user.id,
      teamId,
      recipientId,
    });
  });
