import type { Document } from '@prisma/client';
import { DocumentDataType } from '@prisma/client';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { getDocumentWithDetailsById } from '@documenso/lib/server-only/document/get-document-with-details-by-id';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import {
  ZCreateDocumentFromDirectTemplateResponseSchema,
  createDocumentFromDirectTemplate,
} from '@documenso/lib/server-only/template/create-document-from-direct-template';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import {
  ZCreateTemplateResponseSchema,
  createTemplate,
} from '@documenso/lib/server-only/template/create-template';
import { createTemplateDirectLink } from '@documenso/lib/server-only/template/create-template-direct-link';
import { deleteTemplate } from '@documenso/lib/server-only/template/delete-template';
import { deleteTemplateDirectLink } from '@documenso/lib/server-only/template/delete-template-direct-link';
import { duplicateTemplate } from '@documenso/lib/server-only/template/duplicate-template';
import { findTemplates } from '@documenso/lib/server-only/template/find-templates';
import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import { toggleTemplateDirectLink } from '@documenso/lib/server-only/template/toggle-template-direct-link';
import { updateTemplate } from '@documenso/lib/server-only/template/update-template';
import { getPresignPostUrl } from '@documenso/lib/universal/upload/server-actions';

import { ZGenericSuccessResponse, ZSuccessResponseSchema } from '../document-router/schema';
import { authenticatedProcedure, maybeAuthenticatedProcedure, router } from '../trpc';
import {
  ZBulkSendTemplateMutationSchema,
  ZCreateDocumentFromDirectTemplateRequestSchema,
  ZCreateDocumentFromTemplateRequestSchema,
  ZCreateDocumentFromTemplateResponseSchema,
  ZCreateTemplateDirectLinkRequestSchema,
  ZCreateTemplateDirectLinkResponseSchema,
  ZCreateTemplateMutationSchema,
  ZCreateTemplateV2RequestSchema,
  ZCreateTemplateV2ResponseSchema,
  ZDeleteTemplateDirectLinkRequestSchema,
  ZDeleteTemplateMutationSchema,
  ZDuplicateTemplateMutationSchema,
  ZDuplicateTemplateResponseSchema,
  ZFindTemplatesRequestSchema,
  ZFindTemplatesResponseSchema,
  ZGetTemplateByIdRequestSchema,
  ZGetTemplateByIdResponseSchema,
  ZToggleTemplateDirectLinkRequestSchema,
  ZToggleTemplateDirectLinkResponseSchema,
  ZUpdateTemplateRequestSchema,
  ZUpdateTemplateResponseSchema,
} from './schema';

export const templateRouter = router({
  /**
   * @public
   */
  findTemplates: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/template',
        summary: 'Find templates',
        description: 'Find templates based on a search criteria',
        tags: ['Template'],
      },
    })
    .input(ZFindTemplatesRequestSchema)
    .output(ZFindTemplatesResponseSchema)
    .query(async ({ input, ctx }) => {
      const { teamId } = ctx;

      ctx.logger.info({
        input: {
          folderId: input.folderId,
        },
      });

      return await findTemplates({
        userId: ctx.user.id,
        teamId,
        ...input,
      });
    }),

  /**
   * @public
   */
  getTemplateById: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/template/{templateId}',
        summary: 'Get template',
        tags: ['Template'],
      },
    })
    .input(ZGetTemplateByIdRequestSchema)
    .output(ZGetTemplateByIdResponseSchema)
    .query(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId } = input;

      ctx.logger.info({
        input: {
          templateId,
        },
      });

      return await getTemplateById({
        id: templateId,
        userId: ctx.user.id,
        teamId,
      });
    }),

  /**
   * Wait until RR7 so we can passthrough documents.
   *
   * @private
   */
  createTemplate: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/template/create',
    //     summary: 'Create template',
    //     description: 'Create a new template',
    //     tags: ['Template'],
    //   },
    // })
    .input(ZCreateTemplateMutationSchema)
    .output(ZCreateTemplateResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { title, templateDocumentDataId, folderId } = input;

      ctx.logger.info({
        input: {
          folderId,
        },
      });

      return await createTemplate({
        userId: ctx.user.id,
        teamId,
        templateDocumentDataId,
        data: {
          title,
          folderId,
        },
      });
    }),

  /**
   * Temporariy endpoint for V2 Beta until we allow passthrough documents on create.
   *
   * @public
   * @deprecated
   */
  createTemplateTemporary: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/create/beta',
        summary: 'Create template',
        description:
          'You will need to upload the PDF to the provided URL returned. Note: Once V2 API is released, this will be removed since we will allow direct uploads, instead of using an upload URL.',
        tags: ['Template'],
      },
    })
    .input(ZCreateTemplateV2RequestSchema)
    .output(ZCreateTemplateV2ResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;

      const {
        title,
        folderId,
        externalId,
        visibility,
        globalAccessAuth,
        globalActionAuth,
        publicTitle,
        publicDescription,
        type,
        meta,
      } = input;

      const fileName = title.endsWith('.pdf') ? title : `${title}.pdf`;

      const { url, key } = await getPresignPostUrl(fileName, 'application/pdf');

      const templateDocumentData = await createDocumentData({
        data: key,
        type: DocumentDataType.S3_PATH,
      });

      const createdTemplate = await createTemplate({
        userId: user.id,
        teamId,
        templateDocumentDataId: templateDocumentData.id,
        data: {
          title,
          folderId,
          externalId,
          visibility,
          globalAccessAuth,
          globalActionAuth,
          publicTitle,
          publicDescription,
          type,
        },
        meta,
      });

      const fullTemplate = await getTemplateById({
        id: createdTemplate.id,
        userId: user.id,
        teamId,
      });

      return {
        template: fullTemplate,
        uploadUrl: url,
      };
    }),

  /**
   * @public
   */
  updateTemplate: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/update',
        summary: 'Update template',
        tags: ['Template'],
      },
    })
    .input(ZUpdateTemplateRequestSchema)
    .output(ZUpdateTemplateResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, data, meta } = input;
      const userId = ctx.user.id;

      ctx.logger.info({
        input: {
          templateId,
        },
      });

      return await updateTemplate({
        userId,
        teamId,
        templateId,
        data,
        meta,
      });
    }),

  /**
   * @public
   */
  duplicateTemplate: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/duplicate',
        summary: 'Duplicate template',
        tags: ['Template'],
      },
    })
    .input(ZDuplicateTemplateMutationSchema)
    .output(ZDuplicateTemplateResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId } = input;

      ctx.logger.info({
        input: {
          templateId,
        },
      });

      return await duplicateTemplate({
        userId: ctx.user.id,
        teamId,
        templateId,
      });
    }),

  /**
   * @public
   */
  deleteTemplate: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/delete',
        summary: 'Delete template',
        tags: ['Template'],
      },
    })
    .input(ZDeleteTemplateMutationSchema)
    .output(ZSuccessResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId } = input;
      const userId = ctx.user.id;

      ctx.logger.info({
        input: {
          templateId,
        },
      });

      await deleteTemplate({ userId, id: templateId, teamId });

      return ZGenericSuccessResponse;
    }),

  /**
   * @public
   */
  createDocumentFromTemplate: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/use',
        summary: 'Use template',
        description: 'Use the template to create a document',
        tags: ['Template'],
      },
    })
    .input(ZCreateDocumentFromTemplateRequestSchema)
    .output(ZCreateDocumentFromTemplateResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const { teamId } = ctx;
      const {
        templateId,
        recipients,
        distributeDocument,
        customDocumentDataId,
        prefillFields,
        folderId,
      } = input;

      ctx.logger.info({
        input: {
          templateId,
        },
      });

      const limits = await getServerLimits({ userId: ctx.user.id, teamId });

      if (limits.remaining.documents === 0) {
        throw new Error('You have reached your document limit.');
      }

      const document: Document = await createDocumentFromTemplate({
        templateId,
        teamId,
        userId: ctx.user.id,
        recipients,
        customDocumentDataId,
        requestMetadata: ctx.metadata,
        folderId,
        prefillFields,
      });

      if (distributeDocument) {
        await sendDocument({
          documentId: document.id,
          userId: ctx.user.id,
          teamId,
          requestMetadata: ctx.metadata,
        }).catch((err) => {
          console.error(err);

          throw new AppError('DOCUMENT_SEND_FAILED');
        });
      }

      return getDocumentWithDetailsById({
        documentId: document.id,
        userId: ctx.user.id,
        teamId,
      });
    }),

  /**
   * Leaving this endpoint as private for now until there is a use case for it.
   *
   * @private
   */
  createDocumentFromDirectTemplate: maybeAuthenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/template/direct/use',
    //     summary: 'Use direct template',
    //     description: 'Use a direct template to create a document',
    //     tags: ['Template'],
    //   },
    // })
    .input(ZCreateDocumentFromDirectTemplateRequestSchema)
    .output(ZCreateDocumentFromDirectTemplateResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const {
        directRecipientName,
        directRecipientEmail,
        directTemplateToken,
        directTemplateExternalId,
        signedFieldValues,
        templateUpdatedAt,
      } = input;

      ctx.logger.info({
        input: {
          directTemplateToken,
        },
      });

      return await createDocumentFromDirectTemplate({
        directRecipientName,
        directRecipientEmail,
        directTemplateToken,
        directTemplateExternalId,
        signedFieldValues,
        templateUpdatedAt,
        user: ctx.user
          ? {
              id: ctx.user.id,
              name: ctx.user.name || undefined,
              email: ctx.user.email,
            }
          : undefined,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   */
  createTemplateDirectLink: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/direct/create',
        summary: 'Create direct link',
        description: 'Create a direct link for a template',
        tags: ['Template'],
      },
    })
    .input(ZCreateTemplateDirectLinkRequestSchema)
    .output(ZCreateTemplateDirectLinkResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, directRecipientId } = input;

      const userId = ctx.user.id;

      ctx.logger.info({
        input: {
          templateId,
          directRecipientId,
        },
      });

      const template = await getTemplateById({ id: templateId, teamId, userId: ctx.user.id });

      const limits = await getServerLimits({ userId: ctx.user.id, teamId: template.teamId });

      if (limits.remaining.directTemplates === 0) {
        throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
          message: 'You have reached your direct templates limit.',
        });
      }

      return await createTemplateDirectLink({ userId, teamId, templateId, directRecipientId });
    }),

  /**
   * @public
   */
  deleteTemplateDirectLink: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/direct/delete',
        summary: 'Delete direct link',
        description: 'Delete a direct link for a template',
        tags: ['Template'],
      },
    })
    .input(ZDeleteTemplateDirectLinkRequestSchema)
    .output(ZSuccessResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId } = input;

      const userId = ctx.user.id;

      ctx.logger.info({
        input: {
          templateId,
        },
      });

      await deleteTemplateDirectLink({ userId, teamId, templateId });

      return ZGenericSuccessResponse;
    }),

  /**
   * @public
   */
  toggleTemplateDirectLink: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/direct/toggle',
        summary: 'Toggle direct link',
        description: 'Enable or disable a direct link for a template',
        tags: ['Template'],
      },
    })
    .input(ZToggleTemplateDirectLinkRequestSchema)
    .output(ZToggleTemplateDirectLinkResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, enabled } = input;

      const userId = ctx.user.id;

      ctx.logger.info({
        input: {
          templateId,
        },
      });

      return await toggleTemplateDirectLink({ userId, teamId, templateId, enabled });
    }),

  /**
   * @private
   */
  uploadBulkSend: authenticatedProcedure
    .input(ZBulkSendTemplateMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const { templateId, teamId, csv, sendImmediately } = input;
      const { user } = ctx;

      ctx.logger.info({
        input: {
          templateId,
          teamId,
        },
      });

      if (csv.length > 4 * 1024 * 1024) {
        throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
          message: 'File size exceeds 4MB limit',
          statusCode: 400,
        });
      }

      const template = await getTemplateById({
        id: templateId,
        teamId,
        userId: user.id,
      });

      if (!template) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Template not found',
        });
      }

      await jobs.triggerJob({
        name: 'internal.bulk-send-template',
        payload: {
          userId: user.id,
          teamId,
          templateId,
          csvContent: csv,
          sendImmediately,
          requestMetadata: ctx.metadata.requestMetadata,
        },
      });

      return { success: true };
    }),
});
