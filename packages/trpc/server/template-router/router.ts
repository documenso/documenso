import { TRPCError } from '@trpc/server';

import { createDocumentFromTempate } from '@documenso/lib/server-only/template/create-document-from-template';
import { createTemplate } from '@documenso/lib/server-only/template/create-template';

import { authenticatedProcedure, router } from '../trpc';
import { ZCreateDocumentFromTemplateMutationSchema, ZCreateTemplateMutationSchema } from './schema';

export const templateRouter = router({
  createTemplate: authenticatedProcedure
    .input(ZCreateTemplateMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { title, templateDocumentDataId } = input;

        return await createTemplate({
          title,
          userId: ctx.user.id,
          templateDocumentDataId,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to create this document. Please try again later.',
        });
      }
    }),

  createDocumentFromTempate: authenticatedProcedure
    .input(ZCreateDocumentFromTemplateMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { templateId } = input;

        return await createDocumentFromTempate({
          templateId,
          userId: ctx.user.id,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to create this document. Please try again later.',
        });
      }
    }),
});
