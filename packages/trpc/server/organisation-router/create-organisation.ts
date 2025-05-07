import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateOrganisationRequestSchema,
  ZCreateOrganisationResponseSchema,
} from './create-organisation.types';

export const createOrganisationRoute = authenticatedProcedure
  // .meta(createOrganisationMeta)
  .input(ZCreateOrganisationRequestSchema)
  .output(ZCreateOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { name, url } = input;
    const { user } = ctx;

    await createOrganisation({
      userId: user.id,
      name,
      url,
    });
  });
