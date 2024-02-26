import { TRPCError } from '@trpc/server';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { createTemplate } from '@documenso/lib/server-only/template/create-template';
import { deleteTemplate } from '@documenso/lib/server-only/template/delete-template';
import { duplicateTemplate } from '@documenso/lib/server-only/template/duplicate-template';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZCreateDocumentFromTemplateMutationSchema,
  ZCreateTemplateMutationSchema,
  ZDeleteTemplateMutationSchema,
  ZDuplicateTemplateMutationSchema,
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

        return await createDocumentFromTemplate({
          templateId,
          teamId,
          userId: ctx.user.id,
          recipients: input.recipients,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to create this document. Please try again later.',
        });
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
});
