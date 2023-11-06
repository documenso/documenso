import { setupTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/setup-2fa';

import { authenticatedProcedure, router } from '../trpc';
import { ZSetupMutation } from './schema';

export const twoFactorRouter = router({
  setup: authenticatedProcedure
    .input(ZSetupMutation)
    .mutation(async ({ ctx: { user }, input: { password } }) => {
      return await setupTwoFactorAuthentication({ user, password });
    }),
});
