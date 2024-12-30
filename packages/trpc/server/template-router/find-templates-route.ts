import { z } from 'zod';

import { findTemplates } from '@documenso/lib/server-only/template/find-templates';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import { TemplateType } from '@documenso/prisma/client';
import {
  DocumentDataSchema,
  FieldSchema,
  RecipientSchema,
  TeamSchema,
  TemplateDirectLinkSchema,
  TemplateMetaSchema,
  TemplateSchema,
} from '@documenso/prisma/generated/zod';

import { authenticatedProcedure } from '../trpc';

export const ZFindTemplatesRequestSchema = ZFindSearchParamsSchema.extend({
  teamId: z.number().optional(),
  type: z.nativeEnum(TemplateType).optional(),
});

export const ZFindTemplatesResponseSchema = ZFindResultResponse.extend({
  data: TemplateSchema.extend({
    templateDocumentData: DocumentDataSchema,
    team: TeamSchema.pick({
      id: true,
      url: true,
    }).nullable(),
    Field: FieldSchema.array(),
    Recipient: RecipientSchema.array(),
    templateMeta: TemplateMetaSchema.pick({
      signingOrder: true,
      distributionMethod: true,
    }).nullable(),
    directLink: TemplateDirectLinkSchema.pick({
      token: true,
      enabled: true,
    }).nullable(),
  }).array(), // Todo: openapi.
});

export type FindTemplateRow = z.infer<typeof ZFindTemplatesResponseSchema>['data'][number];

export const findTemplatesRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'GET',
      path: '/template/find',
      summary: 'Find templates',
      description: 'Find templates based on a search criteria',
      tags: ['Template'],
    },
  })
  .input(ZFindTemplatesRequestSchema)
  .output(ZFindTemplatesResponseSchema)
  .query(async ({ input, ctx }) => {
    return await findTemplates({
      userId: ctx.user.id,
      ...input,
    });
  });
