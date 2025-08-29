import { updateUser } from '@documenso/lib/server-only/admin/update-user';

import { adminProcedure } from '../trpc';
import { ZUpdateUserRequestSchema, ZUpdateUserResponseSchema } from './update-user.types';

export const updateUserRoute = adminProcedure
  .input(ZUpdateUserRequestSchema)
  .output(ZUpdateUserResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id, name, email, roles } = input;

    ctx.logger.info({
      input: {
        id,
        roles,
      },
    });

    await updateUser({ id, name, email, roles });
  });
