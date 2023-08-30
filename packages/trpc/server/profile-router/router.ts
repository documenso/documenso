import { TRPCError } from '@trpc/server';

import { updatePassword } from '@documenso/lib/server-only/user/update-password';
import { updateProfile } from '@documenso/lib/server-only/user/update-profile';

import { authenticatedProcedure, router } from '../trpc';
import { ZUpdatePasswordMutationSchema, ZUpdateProfileMutationSchema } from './schema';

export const profileRouter = router({
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
        const { password } = input;

        return await updatePassword({
          userId: ctx.user.id,
          password,
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
});
