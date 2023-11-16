import { TRPCError } from '@trpc/server';

import { forgotPassword } from '@documenso/lib/server-only/user/forgot-password';
import { getUserById } from '@documenso/lib/server-only/user/get-user-by-id';
import { resetPassword } from '@documenso/lib/server-only/user/reset-password';
import { updatePassword } from '@documenso/lib/server-only/user/update-password';
import { updateProfile } from '@documenso/lib/server-only/user/update-profile';

import { adminProcedure, authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZForgotPasswordFormSchema,
  ZResetPasswordFormSchema,
  ZRetrieveUserByIdQuerySchema,
  ZUpdatePasswordMutationSchema,
  ZUpdateProfileMutationSchema,
} from './schema';

export const profileRouter = router({
  getUser: adminProcedure.input(ZRetrieveUserByIdQuerySchema).query(async ({ input }) => {
    try {
      const { id } = input;

      return await getUserById({ id });
    } catch (err) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to retrieve the specified account. Please try again.',
      });
    }
  }),

  updateProfile: authenticatedProcedure
    .input(ZUpdateProfileMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { name, signature } = input;

        return await updateProfile({
          userId: ctx.user.id,
          name,
          signature,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'We were unable to update your profile. Please review the information you provided and try again.',
        });
      }
    }),

  updatePassword: authenticatedProcedure
    .input(ZUpdatePasswordMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { password, currentPassword } = input;

        return await updatePassword({
          userId: ctx.user.id,
          password,
          currentPassword,
        });
      } catch (err) {
        let message =
          'We were unable to update your profile. Please review the information you provided and try again.';

        if (err instanceof Error) {
          message = err.message;
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        });
      }
    }),

  forgotPassword: procedure.input(ZForgotPasswordFormSchema).mutation(async ({ input }) => {
    try {
      const { email } = input;

      return await forgotPassword({
        email,
      });
    } catch (err) {
      console.error(err);
    }
  }),

  resetPassword: procedure.input(ZResetPasswordFormSchema).mutation(async ({ input }) => {
    try {
      const { password, token } = input;

      return await resetPassword({
        token,
        password,
      });
    } catch (err) {
      let message = 'We were unable to reset your password. Please try again.';

      if (err instanceof Error) {
        message = err.message;
      }

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message,
      });
    }
  }),
});
