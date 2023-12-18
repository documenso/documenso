import { TRPCError } from '@trpc/server';

import { removeSignedFieldWithToken } from '@documenso/lib/server-only/field/remove-signed-field-with-token';
import { setFieldsForDocument } from '@documenso/lib/server-only/field/set-fields-for-document';
import { signFieldWithToken } from '@documenso/lib/server-only/field/sign-field-with-token';

import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZAddFieldsMutationSchema,
  ZRemovedSignedFieldWithTokenMutationSchema,
  ZSignFieldWithTokenMutationSchema,
} from './schema';

export const fieldRouter = router({
  addFields: authenticatedProcedure
    .input(ZAddFieldsMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { documentId, fields } = input;

        return await setFieldsForDocument({
          documentId,
          userId: ctx.user.id,
          fields: fields.map((field) => ({
            id: field.nativeId,
            signerEmail: field.signerEmail,
            type: field.type,
            pageNumber: field.pageNumber,
            pageX: field.pageX,
            pageY: field.pageY,
            pageWidth: field.pageWidth,
            pageHeight: field.pageHeight,
          })),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to sign this field. Please try again later.',
        });
      }
    }),

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
