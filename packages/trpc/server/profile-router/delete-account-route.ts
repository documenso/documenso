import { deleteUser } from '@documenso/lib/server-only/user/delete-user';

import { authenticatedProcedure } from '../trpc';

export const deleteAccountRoute = authenticatedProcedure.mutation(async ({ ctx }) => {
  return await deleteUser({
    id: ctx.user.id,
  });
});
