import { TRPCError } from '@trpc/server';

import { removeSignedFieldWithToken } from '@documenso/lib/server-only/field/remove-signed-field-with-token';
import { signFieldWithToken } from '@documenso/lib/server-only/field/sign-field-with-token';

import { procedure, router } from '../trpc';
import {
  ZRemovedSignedFieldWithTokenMutationSchema,
  ZSignFieldWithTokenMutationSchema,
} from './schema';

export const fieldRouter = router({
  signFieldWithToken: procedure
    .input(ZSignFieldWithTokenMutationSchema)
    .mutation(async ({ input }) => {
      try {
        const { token, fieldId, value, isBase64 } = input;

        return await signFieldWithToken({
          token,
          fieldId,
          value,
          isBase64,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to sign this field. Please try again later.',
        });
      }
    }),

  removeSignedFieldWithToken: procedure
    .input(ZRemovedSignedFieldWithTokenMutationSchema)
    .mutation(async ({ input }) => {
      try {
        const { token, fieldId } = input;

        return await removeSignedFieldWithToken({
          token,
          fieldId,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to remove the signature for this field. Please try again later.',
        });
      }
    }),
});
