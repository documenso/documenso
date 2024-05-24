import { TRPCError } from '@trpc/server';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError } from '@documenso/lib/errors/app-error';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { createTemplate } from '@documenso/lib/server-only/template/create-template';
import { deleteTemplate } from '@documenso/lib/server-only/template/delete-template';
import { duplicateTemplate } from '@documenso/lib/server-only/template/duplicate-template';
import { getTemplateWithDetailsById } from '@documenso/lib/server-only/template/get-template-with-details-by-id';
import { updateTemplateSettings } from '@documenso/lib/server-only/template/update-template-settings';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import type { Document } from '@documenso/prisma/client';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZCreateDocumentFromTemplateMutationSchema,
  ZCreateTemplateMutationSchema,
  ZDeleteTemplateMutationSchema,
  ZDuplicateTemplateMutationSchema,
  ZGetTemplateWithDetailsByIdQuerySchema,
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

  createDocumentFromTemplate: authenticatedProcedure
    .input(ZCreateDocumentFromTemplateMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { templateId, teamId } = input;

        const limits = await getServerLimits({ email: ctx.user.email });

        if (limits.remaining.documents === 0) {
          throw new Error('You have reached your document limit.');
        }

        const requestMetadata = extractNextApiRequestMetadata(ctx.req);

        let document: Document = await createDocumentFromTemplate({
          templateId,
          teamId,
          userId: ctx.user.id,
          recipients: input.recipients,
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
        const { id } = input;

        const userId = ctx.user.id;

        return await deleteTemplate({ userId, id });
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
          meta,
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
});
