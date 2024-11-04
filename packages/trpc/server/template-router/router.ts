import { TRPCError } from '@trpc/server';

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
import { getTemplateWithDetailsById } from '@documenso/lib/server-only/template/get-template-with-details-by-id';
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
  ZGetTemplateWithDetailsByIdQuerySchema,
  ZMoveTemplatesToTeamSchema,
  ZSetSigningOrderForTemplateMutationSchema,
  ZToggleTemplateDirectLinkMutationSchema,
  ZUpdateTemplateSettingsMutationSchema,
} from './schema';

export const templateRouter = router({
  createTemplate: authenticatedProcedure
    .input(ZCreateTemplateMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { teamId, title, templateDocumentDataId } = input;

        return await createTemplate({
          userId: ctx.user.id,
          teamId,
          title,
          templateDocumentDataId,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to create this template. Please try again later.',
        });
      }
    }),

  createDocumentFromDirectTemplate: maybeAuthenticatedProcedure
    .input(ZCreateDocumentFromDirectTemplateMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
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
      } catch (err) {
        console.error(err);

        throw AppError.parseErrorToTRPCError(err);
      }
    }),

  createDocumentFromTemplate: authenticatedProcedure
    .input(ZCreateDocumentFromTemplateMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
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

        if (input.sendDocument) {
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
      } catch (err) {
        console.error(err);

        throw AppError.parseErrorToTRPCError(err);
      }
    }),

  duplicateTemplate: authenticatedProcedure
    .input(ZDuplicateTemplateMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { teamId, templateId } = input;

        return await duplicateTemplate({
          userId: ctx.user.id,
          teamId,
          templateId,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to duplicate the template. Please try again later.',
        });
      }
    }),

  deleteTemplate: authenticatedProcedure
    .input(ZDeleteTemplateMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, teamId } = input;

        const userId = ctx.user.id;

        return await deleteTemplate({ userId, id, teamId });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to delete this template. Please try again later.',
        });
      }
    }),

  getTemplateWithDetailsById: authenticatedProcedure
    .input(ZGetTemplateWithDetailsByIdQuerySchema)
    .query(async ({ input, ctx }) => {
      try {
        return await getTemplateWithDetailsById({
          id: input.id,
          userId: ctx.user.id,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to find this template. Please try again later.',
        });
      }
    }),

  // Todo: Add API
  updateTemplateSettings: authenticatedProcedure
    .input(ZUpdateTemplateSettingsMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
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
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'We were unable to update the settings for this template. Please try again later.',
        });
      }
    }),

  setSigningOrderForTemplate: authenticatedProcedure
    .input(ZSetSigningOrderForTemplateMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { templateId, teamId, signingOrder } = input;

        return await updateTemplateSettings({
          templateId,
          teamId,
          data: {},
          meta: { signingOrder },
          userId: ctx.user.id,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'We were unable to update the settings for this document. Please try again later.',
        });
      }
    }),

  findTemplates: authenticatedProcedure
    .input(ZFindTemplatesQuerySchema)
    .query(async ({ input, ctx }) => {
      try {
        return await findTemplates({
          userId: ctx.user.id,
          ...input,
        });
      } catch (err) {
        console.error(err);

        throw AppError.parseErrorToTRPCError(err);
      }
    }),

  createTemplateDirectLink: authenticatedProcedure
    .input(ZCreateTemplateDirectLinkMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { templateId, teamId, directRecipientId } = input;

        const userId = ctx.user.id;

        const template = await getTemplateById({ id: templateId, teamId, userId: ctx.user.id });

        const limits = await getServerLimits({ email: ctx.user.email, teamId: template.teamId });

        if (limits.remaining.directTemplates === 0) {
          throw new AppError(
            AppErrorCode.LIMIT_EXCEEDED,
            'You have reached your direct templates limit.',
          );
        }

        return await createTemplateDirectLink({ userId, templateId, directRecipientId });
      } catch (err) {
        console.error(err);

        const error = AppError.parseError(err);
        throw AppError.parseErrorToTRPCError(error);
      }
    }),

  deleteTemplateDirectLink: authenticatedProcedure
    .input(ZDeleteTemplateDirectLinkMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { templateId } = input;

        const userId = ctx.user.id;

        return await deleteTemplateDirectLink({ userId, templateId });
      } catch (err) {
        console.error(err);

        const error = AppError.parseError(err);
        throw AppError.parseErrorToTRPCError(error);
      }
    }),

  toggleTemplateDirectLink: authenticatedProcedure
    .input(ZToggleTemplateDirectLinkMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { templateId, enabled } = input;

        const userId = ctx.user.id;

        return await toggleTemplateDirectLink({ userId, templateId, enabled });
      } catch (err) {
        console.error(err);

        const error = AppError.parseError(err);
        throw AppError.parseErrorToTRPCError(error);
      }
    }),

  moveTemplateToTeam: authenticatedProcedure
    .input(ZMoveTemplatesToTeamSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { templateId, teamId } = input;
        const userId = ctx.user.id;

        return await moveTemplateToTeam({
          templateId,
          teamId,
          userId,
        });
      } catch (err) {
        console.error(err);

        if (err instanceof TRPCError) {
          throw err;
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to move this template. Please try again later.',
        });
      }
    }),
});
