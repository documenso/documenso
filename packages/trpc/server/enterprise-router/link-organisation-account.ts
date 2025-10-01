import { linkOrganisationAccount } from '@documenso/ee/server-only/lib/link-organisation-account';

import { procedure } from '../trpc';
import {
  ZLinkOrganisationAccountRequestSchema,
  ZLinkOrganisationAccountResponseSchema,
} from './link-organisation-account.types';

/**
 * Unauthenicated procedure, do not copy paste.
 */
export const linkOrganisationAccountRoute = procedure
  .input(ZLinkOrganisationAccountRequestSchema)
  .output(ZLinkOrganisationAccountResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { token } = input;

    await linkOrganisationAccount({
      token,
      requestMeta: ctx.metadata.requestMetadata,
    });
  });
