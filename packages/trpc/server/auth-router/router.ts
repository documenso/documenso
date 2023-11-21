import { TRPCError } from '@trpc/server';

import { createUser } from '@documenso/lib/server-only/user/create-user';
import { sendConfirmationToken } from '@documenso/lib/server-only/user/send-confirmation-token';

import { procedure, router } from '../trpc';
import { ZSignUpMutationSchema } from './schema';

export const authRouter = router({
  signup: procedure.input(ZSignUpMutationSchema).mutation(async ({ input }) => {
    try {
      const { name, email, password, signature } = input;

      const user = await createUser({ name, email, password, signature });

      await sendConfirmationToken({ email: user.email });

      return user;
    } catch (err) {
      let message =
        'We were unable to create your account. Please review the information you provided and try again.';

      if (err instanceof Error && err.message === 'User already exists') {
        message = 'User with this email already exists. Please use a different email address.';
      }

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message,
      });
    }
  }),
});
