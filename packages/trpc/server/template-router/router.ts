import { TRPCError } from '@trpc/server';

import { prisma } from '@documenso/prisma';

import { authenticatedProcedure, router } from '../trpc';
import { ZCreateDocumentFromTemplateMutationSchema, ZCreateTemplateMutationSchema } from './schema';

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

  createDocumentFromTempate: authenticatedProcedure
    .input(ZCreateDocumentFromTemplateMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { templateId } = input;

        const template = await prisma.template.findUnique({
          where: { id: templateId, userId: ctx.user.id },
          include: {
            TemplateRecipient: true,
            TemplateField: true,
            templateDocumentData: true,
          },
        });

        if (!template) {
          throw new Error('Template not found.');
        }

        const documentData = await prisma.documentData.create({
          data: {
            type: template.templateDocumentData.type,
            data: template.templateDocumentData.data,
            initialData: template.templateDocumentData.initialData,
          },
        });

        const document = await prisma.document.create({
          data: {
            userId: ctx.user.id,
            title: template.title,
            documentDataId: documentData.id,
            Recipient: {
              create: template.TemplateRecipient.map((recipient) => ({
                email: recipient.email,
                name: recipient.placeholder,
                token: recipient.token,
              })),
            },
          },

          include: {
            Recipient: true,
          },
        });

        await prisma.field.createMany({
          data: template.TemplateField.map((field) => {
            const recipient = template.TemplateRecipient.find(
              (recipient) => recipient.id === field.recipientId,
            );

            const documentRecipient = document.Recipient.find(
              (doc) => doc.token === recipient?.token,
            );

            return {
              type: field.type,
              page: field.page,
              positionX: field.positionX,
              positionY: field.positionY,
              width: field.width,
              height: field.height,
              customText: field.customText,
              inserted: field.inserted,
              documentId: document.id,
              recipientId: documentRecipient?.id || null,
            };
          }),
        });

        return document;
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to create this document. Please try again later.',
        });
      }
    }),
});
