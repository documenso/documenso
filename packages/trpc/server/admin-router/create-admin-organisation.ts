import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';
import { getSubscriptionClaim } from '@documenso/lib/server-only/subscription/get-subscription-claim';
import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';
import { OrganisationType } from '@prisma/client';
import { adminProcedure } from '../trpc';
import {
  ZCreateAdminOrganisationRequestSchema,
  ZCreateAdminOrganisationResponseSchema,
} from './create-admin-organisation.types';

export const createAdminOrganisationRoute = adminProcedure
  .input(ZCreateAdminOrganisationRequestSchema)
  .output(ZCreateAdminOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { ownerUserId, data } = input;

    ctx.logger.info({
      input: {
        ownerUserId,
      },
    });

    const freeSubscriptionClaim = await getSubscriptionClaim(INTERNAL_CLAIM_ID.FREE);

    const organisation = await createOrganisation({
      userId: ownerUserId,
      name: data.name,
      type: OrganisationType.ORGANISATION,
      claim: freeSubscriptionClaim,
    });

    return {
      organisationId: organisation.id,
    };
  });
