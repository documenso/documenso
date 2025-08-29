import { getUserById } from '@documenso/lib/server-only/user/get-user-by-id';

import { adminProcedure } from '../trpc';
import { ZGetUserRequestSchema, ZGetUserResponseSchema } from './get-user.types';

export const getUserRoute = adminProcedure
  .input(ZGetUserRequestSchema)
  .output(ZGetUserResponseSchema)
  .query(async ({ input, ctx }) => {
    const { id } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    return await getUserById({ id });
  });
