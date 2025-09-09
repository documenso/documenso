import { ORGANISATION_ACCOUNT_LINK_VERIFICATION_TOKEN_IDENTIFIER } from '@documenso/lib/constants/organisations';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  ZDeclineLinkOrganisationAccountRequestSchema,
  ZDeclineLinkOrganisationAccountResponseSchema,
} from './decline-link-organisation-account.types';

/**
 * Unauthenicated procedure, do not copy paste.
 */
export const declineLinkOrganisationAccountRoute = procedure
  .input(ZDeclineLinkOrganisationAccountRequestSchema)
  .output(ZDeclineLinkOrganisationAccountResponseSchema)
  .mutation(async ({ input }) => {
    const { token } = input;

    await prisma.verificationToken.delete({
      where: {
        token,
        identifier: ORGANISATION_ACCOUNT_LINK_VERIFICATION_TOKEN_IDENTIFIER,
      },
    });
  });
