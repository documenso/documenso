import { TRPCError } from '@trpc/server';

import { AppError } from '@documenso/lib/errors/app-error';
import { getFieldById } from '@documenso/lib/server-only/field/get-field-by-id';
import { removeSignedFieldWithToken } from '@documenso/lib/server-only/field/remove-signed-field-with-token';
import { setFieldsForDocument } from '@documenso/lib/server-only/field/set-fields-for-document';
import { setFieldsForTemplate } from '@documenso/lib/server-only/field/set-fields-for-template';
import { signFieldWithToken } from '@documenso/lib/server-only/field/sign-field-with-token';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZAddFieldsMutationSchema,
  ZAddTemplateFieldsMutationSchema,
  ZGetFieldQuerySchema,
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
            fieldMeta: field.fieldMeta,
          })),
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to set this field. Please try again later.',
        });
      }
    }),

  addTemplateFields: authenticatedProcedure
    .input(ZAddTemplateFieldsMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { templateId, fields } = input;

      try {
        return await setFieldsForTemplate({
          userId: ctx.user.id,
          templateId,
          fields: fields.map((field) => ({
            id: field.nativeId,
            signerEmail: field.signerEmail,
            type: field.type,
            pageNumber: field.pageNumber,
            pageX: field.pageX,
            pageY: field.pageY,
            pageWidth: field.pageWidth,
            pageHeight: field.pageHeight,
            fieldMeta: field.fieldMeta,
          })),
        });
      } catch (err) {
        console.error(err);

        throw err;
      }
    }),

  signFieldWithToken: procedure
    .input(ZSignFieldWithTokenMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { token, fieldId, value, isBase64, authOptions } = input;

        return await signFieldWithToken({
          token,
          fieldId,
          value,
          isBase64,
          userId: ctx.user?.id,
          authOptions,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw AppError.parseErrorToTRPCError(err);
      }
    }),

  removeSignedFieldWithToken: procedure
    .input(ZRemovedSignedFieldWithTokenMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { token, fieldId } = input;

        return await removeSignedFieldWithToken({
          token,
          fieldId,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to remove the signature for this field. Please try again later.',
        });
      }
    }),

  getField: authenticatedProcedure.input(ZGetFieldQuerySchema).query(async ({ input, ctx }) => {
    try {
      const { fieldId, teamId } = input;

      return await getFieldById({
        userId: ctx.user.id,
        teamId,
        fieldId,
      });
    } catch (err) {
      console.error(err);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to find this field. Please try again.',
      });
    }
  }),

  // This doesn't appear to be used anywhere, and it doesn't seem to support updating template fields
  // so commenting this out for now.
  // updateField: authenticatedProcedure
  //   .input(ZUpdateFieldMutationSchema)
  //   .mutation(async ({ input, ctx }) => {
  //     try {
  //       const { documentId, fieldId, fieldMeta, teamId } = input;

  //       return await updateField({
  //         userId: ctx.user.id,
  //         teamId,
  //         fieldId,
  //         documentId,
  //         requestMetadata: extractNextApiRequestMetadata(ctx.req),
  //         fieldMeta: fieldMeta,
  //       });
  //     } catch (err) {
  //       console.error(err);

  //       throw new TRPCError({
  //         code: 'BAD_REQUEST',
  //         message: 'We were unable to set this field. Please try again later.',
  //       });
  //     }
  //   }),
});
