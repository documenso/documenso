import { getInstanceTwoFactorEnforcementConfig } from '@documenso/lib/server-only/2fa/get-instance-two-factor-enforcement-config';

import { adminProcedure } from '../trpc';
import {
  ZGetTwoFactorEnforcementRequestSchema,
  ZGetTwoFactorEnforcementResponseSchema,
} from './get-two-factor-enforcement.types';

export const getTwoFactorEnforcementRoute = adminProcedure
  .input(ZGetTwoFactorEnforcementRequestSchema)
  .output(ZGetTwoFactorEnforcementResponseSchema)
  .query(async () => {
    return await getInstanceTwoFactorEnforcementConfig();
  });
