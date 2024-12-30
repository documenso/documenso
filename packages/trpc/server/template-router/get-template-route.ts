import { z } from 'zod';

import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import {
  DocumentDataSchema,
  FieldSchema,
  RecipientSchema,
  TemplateDirectLinkSchema,
  TemplateMetaSchema,
  TemplateSchema,
  UserSchema,
} from '@documenso/prisma/generated/zod';

import { authenticatedProcedure } from '../trpc';

export const ZGetTemplateRequestSchema = z.object({
  templateId: z.number().min(1),
  teamId: z.number().optional(),
});

export const ZGetTemplateResponseSchema = TemplateSchema.extend({
  directLink: TemplateDirectLinkSchema.nullable(),
  templateDocumentData: DocumentDataSchema,
  templateMeta: TemplateMetaSchema.nullable(),
  Recipient: RecipientSchema.array(),
  Field: FieldSchema.array(),
  User: UserSchema.pick({
    id: true,
    name: true,
    email: true,
  }),
});

export const getTemplateRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'GET',
      path: '/template/{templateId}',
      summary: 'Get template',
      tags: ['Template'],
    },
  })
  .input(ZGetTemplateRequestSchema)
  .output(ZGetTemplateResponseSchema)
  .query(async ({ input, ctx }) => {
    const { templateId, teamId } = input;

    return await getTemplateById({
      id: templateId,
      userId: ctx.user.id,
      teamId,
    });
  });
