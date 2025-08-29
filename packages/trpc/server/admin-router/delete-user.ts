import { deleteUser } from '@documenso/lib/server-only/user/delete-user';

import { adminProcedure } from '../trpc';
import { ZDeleteUserRequestSchema, ZDeleteUserResponseSchema } from './delete-user.types';

export const deleteUserRoute = adminProcedure
  .input(ZDeleteUserRequestSchema)
  .output(ZDeleteUserResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    await deleteUser({ id });
  });
