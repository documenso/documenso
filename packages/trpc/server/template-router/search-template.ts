import { searchTemplatesWithKeyword } from '@documenso/lib/server-only/template/search-templates-with-keyword';

import { authenticatedProcedure } from '../trpc';
import {
  ZSearchTemplateRequestSchema,
  ZSearchTemplateResponseSchema,
} from './search-template.types';

export const searchTemplateRoute = authenticatedProcedure
  .input(ZSearchTemplateRequestSchema)
  .output(ZSearchTemplateResponseSchema)
  .query(async ({ input, ctx }) => {
    const { query } = input;

    const templates = await searchTemplatesWithKeyword({
      query,
      userId: ctx.user.id,
    });

    return templates;
  });
