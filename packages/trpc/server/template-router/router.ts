import { TRPCError } from '@trpc/server';

import { prisma } from '@documenso/prisma';

import { authenticatedProcedure, router } from '../trpc';
import { ZCreateTemplateMutationSchema } from './schema';

export const templateRouter = router({
  createTemplate: authenticatedProcedure
    .input(ZCreateTemplateMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { title, templateDocumentDataId } = input;

        return await prisma.template.create({
          data: {
            title,
            userId: ctx.user.id,
            templateDocumentDataId,
          },
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
