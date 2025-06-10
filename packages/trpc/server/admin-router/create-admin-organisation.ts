import { OrganisationType } from '@prisma/client';

import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';
import { internalClaims } from '@documenso/lib/types/subscription';

import { adminProcedure } from '../trpc';
import {
  ZCreateAdminOrganisationRequestSchema,
  ZCreateAdminOrganisationResponseSchema,
} from './create-admin-organisation.types';

export const createAdminOrganisationRoute = adminProcedure
  .input(ZCreateAdminOrganisationRequestSchema)
  .output(ZCreateAdminOrganisationResponseSchema)
  .mutation(async ({ input }) => {
    const { ownerUserId, data } = input;

    const organisation = await createOrganisation({
      userId: ownerUserId,
      name: data.name,
      type: OrganisationType.ORGANISATION,
      claim: internalClaims.free,
    });

    return {
      organisationId: organisation.id,
    };
  });
