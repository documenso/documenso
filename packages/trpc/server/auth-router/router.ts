import { TRPCError } from '@trpc/server';

import { createUser } from '@documenso/lib/server-only/user/create-user';

import { procedure, router } from '../trpc';
import { ZSignUpMutationSchema } from './schema';

export const authRouter = router({
  signup: procedure.input(ZSignUpMutationSchema).mutation(async ({ input }) => {
    try {
      const { name, email, password, signature } = input;

      return await createUser({ name, email, password, signature });
    } catch (err) {
      if (err instanceof Error && err.message === 'User already exists') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User with this email already exists. Please use a different email address.',
        });
      } else {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'We were unable to create your account. Please review the information you provided and try again.',
        });
      }
    }
  }),
});
