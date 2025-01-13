import { z } from 'zod';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
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
import {
  ZCreateTemplateDirectLinkResponseSchema,
  createTemplateDirectLink,
} from '@documenso/lib/server-only/template/create-template-direct-link';
import { deleteTemplate } from '@documenso/lib/server-only/template/delete-template';
import { deleteTemplateDirectLink } from '@documenso/lib/server-only/template/delete-template-direct-link';
import {
  ZDuplicateTemplateResponseSchema,
  duplicateTemplate,
} from '@documenso/lib/server-only/template/duplicate-template';
import {
  ZFindTemplatesResponseSchema,
  findTemplates,
} from '@documenso/lib/server-only/template/find-templates';
import {
  ZGetTemplateByIdResponseSchema,
  getTemplateById,
} from '@documenso/lib/server-only/template/get-template-by-id';
import {
  ZMoveTemplateToTeamResponseSchema,
  moveTemplateToTeam,
} from '@documenso/lib/server-only/template/move-template-to-team';
import {
  ZToggleTemplateDirectLinkResponseSchema,
  toggleTemplateDirectLink,
} from '@documenso/lib/server-only/template/toggle-template-direct-link';
import {
  ZUpdateTemplateResponseSchema,
  updateTemplate,
} from '@documenso/lib/server-only/template/update-template';
import type { Document } from '@documenso/prisma/client';

import { authenticatedProcedure, maybeAuthenticatedProcedure, router } from '../trpc';
import {
  ZCreateDocumentFromDirectTemplateRequestSchema,
  ZCreateDocumentFromTemplateRequestSchema,
  ZCreateDocumentFromTemplateResponseSchema,
  ZCreateTemplateDirectLinkMutationSchema,
  ZCreateTemplateMutationSchema,
  ZDeleteTemplateDirectLinkMutationSchema,
  ZDeleteTemplateMutationSchema,
  ZDuplicateTemplateMutationSchema,
  ZFindTemplatesRequestSchema,
  ZGetTemplateByIdRequestSchema,
  ZMoveTemplatesToTeamRequestSchema,
  ZToggleTemplateDirectLinkMutationSchema,
  ZUpdateTemplateRequestSchema,
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
      const { title, templateDocumentDataId } = input;

      return await createTemplate({
        userId: ctx.user.id,
        teamId,
        title,
        templateDocumentDataId,
      });
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
        method: 'DELETE',
        path: '/template/{templateId}',
        summary: 'Delete template',
        tags: ['Template'],
      },
    })
    .input(ZDeleteTemplateMutationSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId } = input;

      const userId = ctx.user.id;

      await deleteTemplate({ userId, id: templateId, teamId });
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
      const { templateId, recipients, distributeDocument, customDocumentDataId } = input;

      const limits = await getServerLimits({ email: ctx.user.email, teamId });

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
    .input(ZCreateTemplateDirectLinkMutationSchema)
    .output(ZCreateTemplateDirectLinkResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, directRecipientId } = input;

      const userId = ctx.user.id;

      const template = await getTemplateById({ id: templateId, teamId, userId: ctx.user.id });

      const limits = await getServerLimits({ email: ctx.user.email, teamId: template.teamId });

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
        method: 'DELETE',
        path: '/template/direct/{templateId}',
        summary: 'Delete direct link',
        description: 'Delete a direct link for a template',
        tags: ['Template'],
      },
    })
    .input(ZDeleteTemplateDirectLinkMutationSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId } = input;

      const userId = ctx.user.id;

      await deleteTemplateDirectLink({ userId, teamId, templateId });
    }),

  /**
   * @public
   */
  toggleTemplateDirectLink: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/{templateId}/direct/toggle',
        summary: 'Toggle direct link',
        description: 'Enable or disable a direct link for a template',
        tags: ['Template'],
      },
    })
    .input(ZToggleTemplateDirectLinkMutationSchema)
    .output(ZToggleTemplateDirectLinkResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, enabled } = input;

      const userId = ctx.user.id;

      return await toggleTemplateDirectLink({ userId, teamId, templateId, enabled });
    }),

  /**
   * @public
   */
  moveTemplateToTeam: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/move',
        summary: 'Move template',
        description: 'Move a template to a team',
        tags: ['Template'],
      },
    })
    .input(ZMoveTemplatesToTeamRequestSchema)
    .output(ZMoveTemplateToTeamResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { templateId, teamId } = input;
      const userId = ctx.user.id;

      return await moveTemplateToTeam({
        templateId,
        teamId,
        userId,
      });
    }),
});
