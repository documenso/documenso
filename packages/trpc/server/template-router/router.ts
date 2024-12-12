import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { isValidLanguageCode } from '@documenso/lib/constants/i18n';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { createDocumentFromDirectTemplate } from '@documenso/lib/server-only/template/create-document-from-direct-template';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { createTemplate } from '@documenso/lib/server-only/template/create-template';
import { createTemplateDirectLink } from '@documenso/lib/server-only/template/create-template-direct-link';
import { deleteTemplate } from '@documenso/lib/server-only/template/delete-template';
import { deleteTemplateDirectLink } from '@documenso/lib/server-only/template/delete-template-direct-link';
import { duplicateTemplate } from '@documenso/lib/server-only/template/duplicate-template';
import { findTemplates } from '@documenso/lib/server-only/template/find-templates';
import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import { moveTemplateToTeam } from '@documenso/lib/server-only/template/move-template-to-team';
import { toggleTemplateDirectLink } from '@documenso/lib/server-only/template/toggle-template-direct-link';
import { updateTemplateSettings } from '@documenso/lib/server-only/template/update-template-settings';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import type { Document } from '@documenso/prisma/client';

import { authenticatedProcedure, maybeAuthenticatedProcedure, router } from '../trpc';
import {
  ZCreateDocumentFromDirectTemplateMutationSchema,
  ZCreateDocumentFromTemplateMutationSchema,
  ZCreateTemplateDirectLinkMutationSchema,
  ZCreateTemplateMutationSchema,
  ZDeleteTemplateDirectLinkMutationSchema,
  ZDeleteTemplateMutationSchema,
  ZDuplicateTemplateMutationSchema,
  ZFindTemplatesQuerySchema,
  ZGetTemplateByIdQuerySchema,
  ZMoveTemplatesToTeamSchema,
  ZSetSigningOrderForTemplateMutationSchema,
  ZToggleTemplateDirectLinkMutationSchema,
  ZUpdateTemplateSettingsMutationSchema,
  ZUpdateTemplateTypedSignatureSettingsMutationSchema,
} from './schema';

export const templateRouter = router({
  findTemplates: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/template/find',
        summary: 'Find templates',
        description: 'Find templates based on a search criteria',
        tags: ['Template'],
      },
    })
    .input(ZFindTemplatesQuerySchema)
    .output(z.unknown())
    .query(async ({ input, ctx }) => {
      return await findTemplates({
        userId: ctx.user.id,
        ...input,
      });
    }),

  getTemplateById: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/template/{templateId}',
        summary: 'Get template',
        tags: ['Template'],
      },
    })
    .input(ZGetTemplateByIdQuerySchema)
    .output(z.unknown())
    .query(async ({ input, ctx }) => {
      const { templateId, teamId } = input;

      return await getTemplateById({
        id: templateId,
        userId: ctx.user.id,
        teamId,
      });
    }),

  createTemplate: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/create',
        summary: 'Create template',
        description: 'Create a new template',
        tags: ['Template'],
      },
    })
    .input(ZCreateTemplateMutationSchema)
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const { teamId, title, templateDocumentDataId } = input;

      return await createTemplate({
        userId: ctx.user.id,
        teamId,
        title,
        templateDocumentDataId,
      });
    }),

  updateTemplate: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/{templateId}',
        summary: 'Update template',
        tags: ['Template'],
      },
    })
    .input(ZUpdateTemplateSettingsMutationSchema)
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const { templateId, teamId, data, meta } = input;

      const userId = ctx.user.id;

      const requestMetadata = extractNextApiRequestMetadata(ctx.req);

      return await updateTemplateSettings({
        userId,
        teamId,
        templateId,
        data,
        meta: {
          ...meta,
          language: isValidLanguageCode(meta?.language) ? meta?.language : undefined,
        },
        requestMetadata,
      });
    }),

  duplicateTemplate: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/{templateId}/duplicate',
        summary: 'Duplicate template',
        tags: ['Template'],
      },
    })
    .input(ZDuplicateTemplateMutationSchema)
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const { teamId, templateId } = input;

      return await duplicateTemplate({
        userId: ctx.user.id,
        teamId,
        templateId,
      });
    }),

  deleteTemplate: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/{templateId}/delete',
        summary: 'Delete template',
        tags: ['Template'],
      },
    })
    .input(ZDeleteTemplateMutationSchema)
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const { templateId, teamId } = input;

      const userId = ctx.user.id;

      await deleteTemplate({ userId, id: templateId, teamId });
    }),

  createDocumentFromTemplate: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/{templateId}/use',
        summary: 'Use template',
        description: 'Use the template to create a document',
        tags: ['Template'],
      },
    })
    .input(ZCreateDocumentFromTemplateMutationSchema)
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const { templateId, teamId, recipients } = input;

      const limits = await getServerLimits({ email: ctx.user.email, teamId });

      if (limits.remaining.documents === 0) {
        throw new Error('You have reached your document limit.');
      }

      const requestMetadata = extractNextApiRequestMetadata(ctx.req);

      let document: Document = await createDocumentFromTemplate({
        templateId,
        teamId,
        userId: ctx.user.id,
        recipients,
        requestMetadata,
      });

      if (input.distributeDocument) {
        document = await sendDocument({
          documentId: document.id,
          userId: ctx.user.id,
          teamId,
          requestMetadata,
        }).catch((err) => {
          console.error(err);

          throw new AppError('DOCUMENT_SEND_FAILED');
        });
      }

      return document;
    }),

  createDocumentFromDirectTemplate: maybeAuthenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/use',
        summary: 'Use direct template',
        description: 'Use a direct template to create a document',
        tags: ['Template'],
      },
    })
    .input(ZCreateDocumentFromDirectTemplateMutationSchema)
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const {
        directRecipientName,
        directRecipientEmail,
        directTemplateToken,
        directTemplateExternalId,
        signedFieldValues,
        templateUpdatedAt,
      } = input;

      const requestMetadata = extractNextApiRequestMetadata(ctx.req);

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
        requestMetadata,
      });
    }),

  // Internal endpoint for now.
  setSigningOrderForTemplate: authenticatedProcedure
    .input(ZSetSigningOrderForTemplateMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { templateId, teamId, signingOrder } = input;

      return await updateTemplateSettings({
        templateId,
        teamId,
        data: {},
        meta: { signingOrder },
        userId: ctx.user.id,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  createTemplateDirectLink: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/{templateId}/direct/create',
        summary: 'Create direct link',
        description: 'Create a direct link for a template',
        tags: ['Template'],
      },
    })
    .input(ZCreateTemplateDirectLinkMutationSchema)
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const { templateId, teamId, directRecipientId } = input;

      const userId = ctx.user.id;

      const template = await getTemplateById({ id: templateId, teamId, userId: ctx.user.id });

      const limits = await getServerLimits({ email: ctx.user.email, teamId: template.teamId });

      if (limits.remaining.directTemplates === 0) {
        throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
          message: 'You have reached your direct templates limit.',
        });
      }

      return await createTemplateDirectLink({ userId, templateId, directRecipientId });
    }),

  deleteTemplateDirectLink: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/{templateId}/direct/delete',
        summary: 'Delete direct link',
        description: 'Delete a direct link for a template',
        tags: ['Template'],
      },
    })
    .input(ZDeleteTemplateDirectLinkMutationSchema)
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const { templateId } = input;

      const userId = ctx.user.id;

      await deleteTemplateDirectLink({ userId, templateId });
    }),

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
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const { templateId, enabled } = input;

      const userId = ctx.user.id;

      return await toggleTemplateDirectLink({ userId, templateId, enabled });
    }),

  moveTemplateToTeam: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/{templateId}/move',
        summary: 'Move template',
        description: 'Move a template to a team',
        tags: ['Template'],
      },
    })
    .input(ZMoveTemplatesToTeamSchema)
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const { templateId, teamId } = input;
      const userId = ctx.user.id;

      return await moveTemplateToTeam({
        templateId,
        teamId,
        userId,
      });
    }),

  // Internal endpoint for now.
  updateTemplateTypedSignatureSettings: authenticatedProcedure
    .input(ZUpdateTemplateTypedSignatureSettingsMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { templateId, teamId, typedSignatureEnabled } = input;

      const template = await getTemplateById({
        id: templateId,
        userId: ctx.user.id,
        teamId,
      }).catch(() => null);

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        });
      }

      return await updateTemplateSettings({
        templateId,
        teamId,
        userId: ctx.user.id,
        data: {},
        meta: {
          typedSignatureEnabled,
        },
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),
});
