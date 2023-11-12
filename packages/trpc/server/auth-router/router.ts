import { TRPCError } from '@trpc/server';
import { compare } from 'bcrypt';

import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { createUser } from '@documenso/lib/server-only/user/create-user';

import { authenticatedProcedure, procedure, router } from '../trpc';
import { ZSignUpMutationSchema, ZVerifyPasswordMutationSchema } from './schema';

export const authRouter = router({
  signup: procedure.input(ZSignUpMutationSchema).mutation(async ({ input }) => {
    try {
      const { name, email, password, signature } = input;

      return await createUser({ name, email, password, signature });
    } catch (err) {
      console.error(err);
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
  verifyPassword: authenticatedProcedure
    .input(ZVerifyPasswordMutationSchema)
    .mutation(async ({ input: { password }, ctx: { user } }) => {
      if (!user.password) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ErrorCode.INCORRECT_PASSWORD,
        });
      }
      const verified = await compare(password, user.password);
      return { verified };
    }),
});
