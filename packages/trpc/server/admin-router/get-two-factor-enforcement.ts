import { getInstanceTwoFactorEnforcementConfig } from '@documenso/lib/server-only/2fa/get-instance-two-factor-enforcement-config';

import { adminProcedure } from '../trpc';
import {
  ZGetTwoFactorEnforcementRequestSchema,
  ZGetTwoFactorEnforcementResponseSchema,
} from './get-two-factor-enforcement.types';

/**
 * Returns the raw stored instance 2FA enforcement configuration together with
 * the license/activation state for the admin settings UI ("configured but
 * inactive" needs the stored values the enforcement policy getter hides).
 *
 * 2FA enforcement metadata: inherits `'none'` from the admin base — admin
 * procedures carry no organisation scope, while the INSTANCE assert still
 * applies via `adminMiddleware`.
 */
export const getTwoFactorEnforcementRoute = adminProcedure
  .input(ZGetTwoFactorEnforcementRequestSchema)
  .output(ZGetTwoFactorEnforcementResponseSchema)
  .query(async () => {
    return await getInstanceTwoFactorEnforcementConfig();
  });
