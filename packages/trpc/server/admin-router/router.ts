import { TRPCError } from '@trpc/server';

import { isAdmin } from '@documenso/lib/next-auth/guards/is-admin';
import { updateUser } from '@documenso/lib/server-only/admin/update-user';

import { authenticatedProcedure, router } from '../trpc';
import { ZUpdateProfileMutationByAdminSchema } from './schema';

export const adminRouter = router({
  updateUser: authenticatedProcedure
    .input(ZUpdateProfileMutationByAdminSchema)
    .mutation(async ({ input, ctx }) => {
      const isUserAdmin = isAdmin(ctx.user);

      if (!isUserAdmin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authorized to perform this action.',
        });
      }

      const { id, name, email, roles } = input;

      try {
        return await updateUser({ id, name, email, roles });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to retrieve the specified account. Please try again.',
        });
      }
    }),
});
