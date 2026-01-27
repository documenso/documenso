import { EnvelopeType } from '@prisma/client';

import { createEnvelopeFields } from '@documenso/lib/server-only/field/create-envelope-fields';
import { deleteDocumentField } from '@documenso/lib/server-only/field/delete-document-field';
import { deleteTemplateField } from '@documenso/lib/server-only/field/delete-template-field';
import { getFieldById } from '@documenso/lib/server-only/field/get-field-by-id';
import { removeSignedFieldWithToken } from '@documenso/lib/server-only/field/remove-signed-field-with-token';
import { setFieldsForDocument } from '@documenso/lib/server-only/field/set-fields-for-document';
import { setFieldsForTemplate } from '@documenso/lib/server-only/field/set-fields-for-template';
import { signFieldWithToken } from '@documenso/lib/server-only/field/sign-field-with-token';
import { updateEnvelopeFields } from '@documenso/lib/server-only/field/update-envelope-fields';

import { ZGenericSuccessResponse, ZSuccessResponseSchema } from '../schema';
import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZCreateDocumentFieldRequestSchema,
  ZCreateDocumentFieldResponseSchema,
  ZCreateDocumentFieldsRequestSchema,
  ZCreateDocumentFieldsResponseSchema,
  ZCreateTemplateFieldRequestSchema,
  ZCreateTemplateFieldResponseSchema,
  ZCreateTemplateFieldsRequestSchema,
  ZCreateTemplateFieldsResponseSchema,
  ZDeleteDocumentFieldRequestSchema,
  ZDeleteTemplateFieldRequestSchema,
  ZGetFieldRequestSchema,
  ZGetFieldResponseSchema,
  ZRemovedSignedFieldWithTokenMutationSchema,
  ZSetDocumentFieldsRequestSchema,
  ZSetDocumentFieldsResponseSchema,
  ZSetFieldsForTemplateRequestSchema,
  ZSetFieldsForTemplateResponseSchema,
  ZSignFieldWithTokenMutationSchema,
  ZUpdateDocumentFieldRequestSchema,
  ZUpdateDocumentFieldResponseSchema,
  ZUpdateDocumentFieldsRequestSchema,
  ZUpdateDocumentFieldsResponseSchema,
  ZUpdateTemplateFieldRequestSchema,
  ZUpdateTemplateFieldResponseSchema,
  ZUpdateTemplateFieldsRequestSchema,
  ZUpdateTemplateFieldsResponseSchema,
} from './schema';

export const fieldRouter = router({
  /**
   * @public
   */
  getDocumentField: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/document/field/{fieldId}',
        summary: 'Get document field',
        description:
          'Returns a single field. If you want to retrieve all the fields for a document, use the "Get Document" endpoint.',
        tags: ['Document Fields'],
      },
    })
    .input(ZGetFieldRequestSchema)
    .output(ZGetFieldResponseSchema)
    .query(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { fieldId } = input;

      ctx.logger.info({
        input: {
          fieldId,
        },
      });

      return await getFieldById({
        userId: ctx.user.id,
        teamId,
        fieldId,
        envelopeType: EnvelopeType.DOCUMENT,
      });
    }),

  /**
   * @public
   */
  createDocumentField: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/field/create',
        summary: 'Create document field',
        description: 'Create a single field for a document.',
        tags: ['Document Fields'],
      },
    })
    .input(ZCreateDocumentFieldRequestSchema)
    .output(ZCreateDocumentFieldResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, field } = input;

      ctx.logger.info({
        input: {
          documentId,
        },
      });

      const createdFields = await createEnvelopeFields({
        userId: ctx.user.id,
        teamId,
        id: {
          type: 'documentId',
          id: documentId,
        },
        fields: [
          {
            ...field,
            page: field.pageNumber,
            positionX: field.pageX,
            positionY: field.pageY,
          },
        ],
        requestMetadata: ctx.metadata,
      });

      return createdFields.fields[0];
    }),

  /**
   * @public
   */
  createDocumentFields: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/field/create-many',
        summary: 'Create document fields',
        description: 'Create multiple fields for a document.',
        tags: ['Document Fields'],
      },
    })
    .input(ZCreateDocumentFieldsRequestSchema)
    .output(ZCreateDocumentFieldsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, fields } = input;

      ctx.logger.info({
        input: {
          documentId,
        },
      });

      return await createEnvelopeFields({
        userId: ctx.user.id,
        teamId,
        id: {
          type: 'documentId',
          id: documentId,
        },
        fields: fields.map((field) => ({
          ...field,
          page: field.pageNumber,
          positionX: field.pageX,
          positionY: field.pageY,
        })),
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   */
  updateDocumentField: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/field/update',
        summary: 'Update document field',
        description: 'Update a single field for a document.',
        tags: ['Document Fields'],
      },
    })
    .input(ZUpdateDocumentFieldRequestSchema)
    .output(ZUpdateDocumentFieldResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, field } = input;

      ctx.logger.info({
        input: {
          documentId,
        },
      });

      const updatedFields = await updateEnvelopeFields({
        userId: ctx.user.id,
        teamId,
        id: {
          type: 'documentId',
          id: documentId,
        },
        type: EnvelopeType.DOCUMENT,
        fields: [field],
        requestMetadata: ctx.metadata,
      });

      return updatedFields.fields[0];
    }),

  /**
   * @public
   */
  updateDocumentFields: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/field/update-many',
        summary: 'Update document fields',
        description: 'Update multiple fields for a document.',
        tags: ['Document Fields'],
      },
    })
    .input(ZUpdateDocumentFieldsRequestSchema)
    .output(ZUpdateDocumentFieldsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, fields } = input;

      ctx.logger.info({
        input: {
          documentId,
        },
      });

      return await updateEnvelopeFields({
        userId: ctx.user.id,
        teamId,
        id: {
          type: 'documentId',
          id: documentId,
        },
        type: EnvelopeType.DOCUMENT,
        fields,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   */
  deleteDocumentField: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/field/delete',
        summary: 'Delete document field',
        tags: ['Document Fields'],
      },
    })
    .input(ZDeleteDocumentFieldRequestSchema)
    .output(ZSuccessResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { fieldId } = input;

      ctx.logger.info({
        input: {
          fieldId,
        },
      });

      await deleteDocumentField({
        userId: ctx.user.id,
        teamId,
        fieldId,
        requestMetadata: ctx.metadata,
      });

      return ZGenericSuccessResponse;
    }),

  /**
   * @private
   */
  setFieldsForDocument: authenticatedProcedure
    .input(ZSetDocumentFieldsRequestSchema)
    .output(ZSetDocumentFieldsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, fields } = input;

      ctx.logger.info({
        input: {
          documentId,
        },
      });

      return await setFieldsForDocument({
        userId: ctx.user.id,
        teamId,
        id: {
          type: 'documentId',
          id: documentId,
        },
        fields: fields.map((field) => ({
          id: field.id,
          recipientId: field.recipientId,
          envelopeItemId: field.envelopeItemId,
          type: field.type,
          pageNumber: field.pageNumber,
          pageX: field.pageX,
          pageY: field.pageY,
          pageWidth: field.pageWidth,
          pageHeight: field.pageHeight,
          fieldMeta: field.fieldMeta,
        })),
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   */
  createTemplateField: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/field/create',
        summary: 'Create template field',
        description: 'Create a single field for a template.',
        tags: ['Template Fields'],
      },
    })
    .input(ZCreateTemplateFieldRequestSchema)
    .output(ZCreateTemplateFieldResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, field } = input;

      ctx.logger.info({
        input: {
          templateId,
        },
      });

      const createdFields = await createEnvelopeFields({
        userId: ctx.user.id,
        teamId,
        id: {
          type: 'templateId',
          id: templateId,
        },
        fields: [
          {
            ...field,
            page: field.pageNumber,
            positionX: field.pageX,
            positionY: field.pageY,
          },
        ],
        requestMetadata: ctx.metadata,
      });

      return createdFields.fields[0];
    }),

  /**
   * @public
   */
  getTemplateField: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/template/field/{fieldId}',
        summary: 'Get template field',
        description:
          'Returns a single field. If you want to retrieve all the fields for a template, use the "Get Template" endpoint.',
        tags: ['Template Fields'],
      },
    })
    .input(ZGetFieldRequestSchema)
    .output(ZGetFieldResponseSchema)
    .query(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { fieldId } = input;

      ctx.logger.info({
        input: {
          fieldId,
        },
      });

      return await getFieldById({
        userId: ctx.user.id,
        teamId,
        fieldId,
        envelopeType: EnvelopeType.TEMPLATE,
      });
    }),

  /**
   * @public
   */
  createTemplateFields: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/field/create-many',
        summary: 'Create template fields',
        description: 'Create multiple fields for a template.',
        tags: ['Template Fields'],
      },
    })
    .input(ZCreateTemplateFieldsRequestSchema)
    .output(ZCreateTemplateFieldsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, fields } = input;

      ctx.logger.info({
        input: {
          templateId,
        },
      });

      return await createEnvelopeFields({
        userId: ctx.user.id,
        teamId,
        id: {
          type: 'templateId',
          id: templateId,
        },
        fields: fields.map((field) => ({
          ...field,
          page: field.pageNumber,
          positionX: field.pageX,
          positionY: field.pageY,
        })),
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   */
  updateTemplateField: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/field/update',
        summary: 'Update template field',
        description: 'Update a single field for a template.',
        tags: ['Template Fields'],
      },
    })
    .input(ZUpdateTemplateFieldRequestSchema)
    .output(ZUpdateTemplateFieldResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, field } = input;

      ctx.logger.info({
        input: {
          templateId,
        },
      });

      const updatedFields = await updateEnvelopeFields({
        userId: ctx.user.id,
        teamId,
        id: {
          type: 'templateId',
          id: templateId,
        },
        type: EnvelopeType.TEMPLATE,
        fields: [field],
        requestMetadata: ctx.metadata,
      });

      return updatedFields.fields[0];
    }),

  /**
   * @public
   */
  updateTemplateFields: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/field/update-many',
        summary: 'Update template fields',
        description: 'Update multiple fields for a template.',
        tags: ['Template Fields'],
      },
    })
    .input(ZUpdateTemplateFieldsRequestSchema)
    .output(ZUpdateTemplateFieldsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, fields } = input;

      ctx.logger.info({
        input: {
          templateId,
        },
      });

      return await updateEnvelopeFields({
        userId: ctx.user.id,
        teamId,
        id: {
          type: 'templateId',
          id: templateId,
        },
        type: EnvelopeType.TEMPLATE,
        fields,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   */
  deleteTemplateField: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/field/delete',
        summary: 'Delete template field',
        tags: ['Template Fields'],
      },
    })
    .input(ZDeleteTemplateFieldRequestSchema)
    .output(ZSuccessResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { fieldId } = input;

      ctx.logger.info({
        input: {
          fieldId,
        },
      });

      await deleteTemplateField({
        userId: ctx.user.id,
        teamId,
        fieldId,
      });

      return ZGenericSuccessResponse;
    }),

  /**
   * @private
   */
  setFieldsForTemplate: authenticatedProcedure
    .input(ZSetFieldsForTemplateRequestSchema)
    .output(ZSetFieldsForTemplateResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, fields } = input;

      ctx.logger.info({
        input: {
          templateId,
        },
      });

      return await setFieldsForTemplate({
        id: {
          type: 'templateId',
          id: templateId,
        },
        userId: ctx.user.id,
        teamId,
        fields: fields.map((field) => ({
          id: field.id,
          recipientId: field.recipientId,
          envelopeItemId: field.envelopeItemId,
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

  /**
   * @private
   */
  signFieldWithToken: procedure
    .input(ZSignFieldWithTokenMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { token, fieldId, value, isBase64, authOptions } = input;

      ctx.logger.info({
        input: {
          fieldId,
        },
      });

      return await signFieldWithToken({
        token,
        fieldId,
        value: value ?? '',
        isBase64,
        userId: ctx.user?.id,
        authOptions,
        requestMetadata: ctx.metadata.requestMetadata,
      });
    }),

  /**
   * @private
   */
  removeSignedFieldWithToken: procedure
    .input(ZRemovedSignedFieldWithTokenMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { token, fieldId } = input;

      ctx.logger.info({
        input: {
          fieldId,
        },
      });

      return await removeSignedFieldWithToken({
        token,
        fieldId,
        requestMetadata: ctx.metadata.requestMetadata,
      });
    }),
});
