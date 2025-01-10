import { z } from 'zod';

import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { rejectDocumentWithToken } from '@documenso/lib/server-only/document/reject-document-with-token';
import {
  ZCreateDocumentRecipientsResponseSchema,
  createDocumentRecipients,
} from '@documenso/lib/server-only/recipient/create-document-recipients';
import {
  ZCreateTemplateRecipientsResponseSchema,
  createTemplateRecipients,
} from '@documenso/lib/server-only/recipient/create-template-recipients';
import { deleteDocumentRecipient } from '@documenso/lib/server-only/recipient/delete-document-recipient';
import { deleteTemplateRecipient } from '@documenso/lib/server-only/recipient/delete-template-recipient';
import {
  ZGetRecipientByIdResponseSchema,
  getRecipientById,
} from '@documenso/lib/server-only/recipient/get-recipient-by-id';
import {
  ZSetDocumentRecipientsResponseSchema,
  setDocumentRecipients,
} from '@documenso/lib/server-only/recipient/set-document-recipients';
import {
  ZSetTemplateRecipientsResponseSchema,
  setTemplateRecipients,
} from '@documenso/lib/server-only/recipient/set-template-recipients';
import { updateDocumentRecipients } from '@documenso/lib/server-only/recipient/update-document-recipients';
import { updateTemplateRecipients } from '@documenso/lib/server-only/recipient/update-template-recipients';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZAddSignersMutationSchema,
  ZCompleteDocumentWithTokenMutationSchema,
  ZCreateDocumentRecipientRequestSchema,
  ZCreateDocumentRecipientResponseSchema,
  ZCreateDocumentRecipientsRequestSchema,
  ZCreateTemplateRecipientRequestSchema,
  ZCreateTemplateRecipientResponseSchema,
  ZCreateTemplateRecipientsRequestSchema,
  ZDeleteDocumentRecipientRequestSchema,
  ZDeleteTemplateRecipientRequestSchema,
  ZGetRecipientQuerySchema,
  ZRejectDocumentWithTokenMutationSchema,
  ZSetDocumentRecipientsRequestSchema,
  ZSetTemplateRecipientsRequestSchema,
  ZUpdateDocumentRecipientRequestSchema,
  ZUpdateDocumentRecipientResponseSchema,
  ZUpdateDocumentRecipientsRequestSchema,
  ZUpdateDocumentRecipientsResponseSchema,
  ZUpdateTemplateRecipientRequestSchema,
  ZUpdateTemplateRecipientResponseSchema,
  ZUpdateTemplateRecipientsRequestSchema,
  ZUpdateTemplateRecipientsResponseSchema,
} from './schema';

export const recipientRouter = router({
  /**
   * @public
   */
  getRecipient: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/recipient/{recipientId}',
        summary: 'Get recipient',
        description:
          'Returns a single recipient. If you want to retrieve all the recipients for a document or template, use the "Get Document" or "Get Template" request.',
        tags: ['Document Recipients', 'Template Recipients'],
      },
    })
    .input(ZGetRecipientQuerySchema)
    .output(ZGetRecipientByIdResponseSchema)
    .query(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { recipientId } = input;

      return await getRecipientById({
        userId: ctx.user.id,
        teamId,
        recipientId,
      });
    }),

  /**
   * @public
   */
  createDocumentRecipient: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/recipient/create',
        summary: 'Create document recipient',
        description: 'Create a single recipient for a document.',
        tags: ['Document Recipients'],
      },
    })
    .input(ZCreateDocumentRecipientRequestSchema)
    .output(ZCreateDocumentRecipientResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, recipient } = input;

      const createdRecipients = await createDocumentRecipients({
        userId: ctx.user.id,
        teamId,
        documentId,
        recipients: [recipient],
        requestMetadata: ctx.metadata,
      });

      return createdRecipients.recipients[0];
    }),

  /**
   * @public
   */
  createDocumentRecipients: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/recipient/create-many',
        summary: 'Create document recipients',
        description: 'Create multiple recipients for a document.',
        tags: ['Document Recipients'],
      },
    })
    .input(ZCreateDocumentRecipientsRequestSchema)
    .output(ZCreateDocumentRecipientsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, recipients } = input;

      return await createDocumentRecipients({
        userId: ctx.user.id,
        teamId,
        documentId,
        recipients,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   */
  updateDocumentRecipient: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/recipient/update',
        summary: 'Update document recipient',
        description: 'Update a single recipient for a document.',
        tags: ['Document Recipients'],
      },
    })
    .input(ZUpdateDocumentRecipientRequestSchema)
    .output(ZUpdateDocumentRecipientResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, recipient } = input;

      const updatedRecipients = await updateDocumentRecipients({
        userId: ctx.user.id,
        teamId,
        documentId,
        recipients: [recipient],
        requestMetadata: ctx.metadata,
      });

      return updatedRecipients.recipients[0];
    }),

  /**
   * @public
   */
  updateDocumentRecipients: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/recipient/update-many',
        summary: 'Update document recipients',
        description: 'Update multiple recipients for a document.',
        tags: ['Document Recipients'],
      },
    })
    .input(ZUpdateDocumentRecipientsRequestSchema)
    .output(ZUpdateDocumentRecipientsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, recipients } = input;

      return await updateDocumentRecipients({
        userId: ctx.user.id,
        teamId,
        documentId,
        recipients,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   */
  deleteDocumentRecipient: authenticatedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/document/recipient/{recipientId}',
        summary: 'Delete document recipient',
        tags: ['Document Recipients'],
      },
    })
    .input(ZDeleteDocumentRecipientRequestSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { recipientId } = input;

      await deleteDocumentRecipient({
        userId: ctx.user.id,
        teamId,
        recipientId,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @private
   */
  setDocumentRecipients: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/document/recipient/set',
    //     summary: 'Set document recipients',
    //     description:
    //       'This will replace all recipients attached to the document. If the array contains existing recipients, they will be updated and the original fields will be retained.',
    //     tags: ['Document Recipients'],
    //   },
    // })
    .input(ZSetDocumentRecipientsRequestSchema)
    .output(ZSetDocumentRecipientsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, recipients } = input;

      return await setDocumentRecipients({
        userId: ctx.user.id,
        teamId,
        documentId,
        recipients: recipients.map((recipient) => ({
          id: recipient.nativeId,
          email: recipient.email,
          name: recipient.name,
          role: recipient.role,
          signingOrder: recipient.signingOrder,
          actionAuth: recipient.actionAuth,
        })),
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   */
  createTemplateRecipient: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/recipient/create',
        summary: 'Create template recipient',
        description: 'Create a single recipient for a template.',
        tags: ['Template Recipients'],
      },
    })
    .input(ZCreateTemplateRecipientRequestSchema)
    .output(ZCreateTemplateRecipientResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, recipient } = input;

      const createdRecipients = await createTemplateRecipients({
        userId: ctx.user.id,
        teamId,
        templateId,
        recipients: [recipient],
      });

      return createdRecipients.recipients[0];
    }),

  /**
   * @public
   */
  createTemplateRecipients: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/recipient/create-many',
        summary: 'Create template recipients',
        description: 'Create multiple recipients for a template.',
        tags: ['Template Recipients'],
      },
    })
    .input(ZCreateTemplateRecipientsRequestSchema)
    .output(ZCreateTemplateRecipientsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, recipients } = input;

      return await createTemplateRecipients({
        userId: ctx.user.id,
        teamId,
        templateId,
        recipients,
      });
    }),

  /**
   * @public
   */
  updateTemplateRecipient: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/recipient/update',
        summary: 'Update template recipient',
        description: 'Update a single recipient for a template.',
        tags: ['Template Recipients'],
      },
    })
    .input(ZUpdateTemplateRecipientRequestSchema)
    .output(ZUpdateTemplateRecipientResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, recipient } = input;

      const updatedRecipients = await updateTemplateRecipients({
        userId: ctx.user.id,
        teamId,
        templateId,
        recipients: [recipient],
      });

      return updatedRecipients.recipients[0];
    }),

  /**
   * @public
   */
  updateTemplateRecipients: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/recipient/update-many',
        summary: 'Update template recipients',
        description: 'Update multiple recipients for a template.',
        tags: ['Template Recipients'],
      },
    })
    .input(ZUpdateTemplateRecipientsRequestSchema)
    .output(ZUpdateTemplateRecipientsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, recipients } = input;

      return await updateTemplateRecipients({
        userId: ctx.user.id,
        teamId,
        templateId,
        recipients,
      });
    }),

  /**
   * @public
   */
  deleteTemplateRecipient: authenticatedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/template/recipient/{recipientId}',
        summary: 'Delete template recipient',
        tags: ['Template Recipients'],
      },
    })
    .input(ZDeleteTemplateRecipientRequestSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { recipientId } = input;

      await deleteTemplateRecipient({
        recipientId,
        userId: ctx.user.id,
        teamId,
      });
    }),

  /**
   * @private
   */
  setTemplateRecipients: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/template/recipient/set',
    //     summary: 'Set template recipients',
    //     description:
    //       'This will replace all recipients attached to the template. If the array contains existing recipients, they will be updated and the original fields will be retained.',
    //     tags: ['Template Recipients'],
    //   },
    // })
    .input(ZSetTemplateRecipientsRequestSchema)
    .output(ZSetTemplateRecipientsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { templateId, recipients } = input;

      return await setTemplateRecipients({
        userId: ctx.user.id,
        teamId,
        templateId,
        recipients: recipients.map((recipient) => ({
          id: recipient.nativeId,
          email: recipient.email,
          name: recipient.name,
          role: recipient.role,
          signingOrder: recipient.signingOrder,
          actionAuth: recipient.actionAuth,
        })),
      });
    }),

  /**
   * @private
   */
  completeDocumentWithToken: procedure
    .input(ZCompleteDocumentWithTokenMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { token, documentId, authOptions } = input;

      return await completeDocumentWithToken({
        token,
        documentId,
        authOptions,
        userId: ctx.user?.id,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  /**
   * @private
   */
  rejectDocumentWithToken: procedure
    .input(ZRejectDocumentWithTokenMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { token, documentId, reason } = input;

      return await rejectDocumentWithToken({
        token,
        documentId,
        reason,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  /**
   * Leaving this here and will remove after deployment.
   *
   * @deprecated Remove after deployment.
   */
  addSigners: authenticatedProcedure
    .input(ZAddSignersMutationSchema)
    .output(ZSetDocumentRecipientsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, signers } = input;

      return await setDocumentRecipients({
        userId: ctx.user.id,
        documentId,
        teamId,
        recipients: signers.map((signer) => ({
          id: signer.nativeId,
          email: signer.email,
          name: signer.name,
          role: signer.role,
          signingOrder: signer.signingOrder,
          actionAuth: signer.actionAuth,
        })),
        requestMetadata: ctx.metadata,
      });
    }),
});
