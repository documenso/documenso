import { linkOrganisationAccount } from '@documenso/ee/server-only/lib/link-organisation-account';
import { assertRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { linkOrgAccountRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';

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

    const rateLimitResult = await linkOrgAccountRateLimit.check({
      ip: ctx.metadata.requestMetadata.ipAddress ?? 'unknown',
      identifier: token,
    });

    assertRateLimit(rateLimitResult);

    await linkOrganisationAccount({
      token,
      requestMeta: ctx.metadata.requestMetadata,
    });
  });
