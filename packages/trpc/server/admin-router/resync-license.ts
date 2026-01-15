import { LicenseClient } from '@documenso/lib/server-only/license/license-client';

import { adminProcedure } from '../trpc';
import { ZResyncLicenseRequestSchema, ZResyncLicenseResponseSchema } from './resync-license.types';

export const resyncLicenseRoute = adminProcedure
  .input(ZResyncLicenseRequestSchema)
  .output(ZResyncLicenseResponseSchema)
  .mutation(async () => {
    const client = LicenseClient.getInstance();

    if (!client) {
      return;
    }

    await client.resync();
  });
