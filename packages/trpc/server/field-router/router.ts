import { z } from 'zod';

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
  getField: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/field/{fieldId}',
        summary: 'Get field',
        description: 'Returns a document or template field',
        tags: ['Fields'],
      },
    })
    .input(ZGetFieldQuerySchema)
    .output(z.unknown())
    .query(async ({ input, ctx }) => {
      const { fieldId, teamId } = input;

      return await getFieldById({
        userId: ctx.user.id,
        teamId,
        fieldId,
      });
    }),

  addFields: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/{documentId}/field',
        summary: 'Set document fields',
        tags: ['Fields'],
      },
    })
    .input(ZAddFieldsMutationSchema)
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
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
    }),

  addTemplateFields: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/{templateId}/field',
        summary: 'Set template fields',
        tags: ['Fields'],
      },
    })
    .input(ZAddTemplateFieldsMutationSchema)
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const { templateId, fields } = input;

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
    }),

  // Internal endpoint for now.
  signFieldWithToken: procedure
    .input(ZSignFieldWithTokenMutationSchema)
    .mutation(async ({ input, ctx }) => {
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
    }),

  // Internal endpoint for now.
  removeSignedFieldWithToken: procedure
    .input(ZRemovedSignedFieldWithTokenMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { token, fieldId } = input;

      return await removeSignedFieldWithToken({
        token,
        fieldId,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),
});
