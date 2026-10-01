import { adminGlobalSearch } from '@documenso/lib/server-only/admin/admin-global-search';

import { adminProcedure } from '../trpc';
import { ZAdminSearchRequestSchema, ZAdminSearchResponseSchema } from './admin-search.types';

export const adminSearchRoute = adminProcedure
  .input(ZAdminSearchRequestSchema)
  .output(ZAdminSearchResponseSchema)
  .query(async ({ input }) => {
    const { query } = input;

    const groups = await adminGlobalSearch({ query });

    return { groups };
  });
