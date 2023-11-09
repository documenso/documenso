import { disableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/disable-2fa';
import { enableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/enable-2fa';
import { setupTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/setup-2fa';

import { authenticatedProcedure, router } from '../trpc';
import { ZDisableMutation, ZEnableMutation, ZSetupMutation } from './schema';

export const twoFactorRouter = router({
  setup: authenticatedProcedure
    .input(ZSetupMutation)
    .mutation(async ({ ctx: { user }, input: { password } }) => {
      return await setupTwoFactorAuthentication({ user, password });
    }),
  enable: authenticatedProcedure
    .input(ZEnableMutation)
    .mutation(async ({ ctx: { user }, input: { code } }) => {
      return await enableTwoFactorAuthentication({ user, code });
    }),
  disable: authenticatedProcedure
    .input(ZDisableMutation)
    .mutation(async ({ ctx: { user }, input: { code, password, backupCode } }) => {
      return await disableTwoFactorAuthentication({ user, code, password, backupCode });
    }),
});
