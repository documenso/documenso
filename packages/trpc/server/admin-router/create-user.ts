import { jobsClient } from '@documenso/lib/jobs/client';
import { createAdminUser } from '@documenso/lib/server-only/user/create-admin-user';

import { adminProcedure } from '../trpc';
import { ZCreateUserRequestSchema, ZCreateUserResponseSchema } from './create-user.types';

export const createUserRoute = adminProcedure
  .input(ZCreateUserRequestSchema)
  .output(ZCreateUserResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { email, name } = input;

    const user = await createAdminUser({
      name,
      email,
    });

    ctx.logger.info({
      createdUserId: user.id,
    });

    await jobsClient.triggerJob({
      name: 'send.admin.user.created.email',
      payload: {
        userId: user.id,
      },
    });

    return {
      userId: user.id,
    };
  });
