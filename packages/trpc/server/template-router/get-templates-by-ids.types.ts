import { ZTemplateManySchema } from '@documenso/lib/types/template';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const getTemplatesByIdsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/template/get-many',
    summary: 'Get multiple templates',
    description:
      'Deprecated: this endpoint is being replaced by the Envelope API. See https://docs.documenso.com/docs/developers/api/migrate-to-envelopes for the migration guide. Retrieve multiple templates by their IDs',
    tags: ['Template'],
    deprecated: true,
  },
};

export const ZGetTemplatesByIdsRequestSchema = z.object({
  templateIds: z.array(z.number()).min(1),
});

export const ZGetTemplatesByIdsResponseSchema = z.object({
  data: z.array(ZTemplateManySchema),
});

export type TGetTemplatesByIdsRequest = z.infer<typeof ZGetTemplatesByIdsRequestSchema>;
export type TGetTemplatesByIdsResponse = z.infer<typeof ZGetTemplatesByIdsResponseSchema>;
