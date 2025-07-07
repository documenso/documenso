import { findDocumentAttachments } from '@documenso/lib/server-only/attachment/find-document-attachments';
import { findTemplateAttachments } from '@documenso/lib/server-only/attachment/find-template-attachments';
import { setDocumentAttachments } from '@documenso/lib/server-only/attachment/set-document-attachments';
import { setTemplateAttachments } from '@documenso/lib/server-only/attachment/set-template-attachments';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZGetDocumentAttachmentsResponseSchema,
  ZGetDocumentAttachmentsSchema,
  ZGetTemplateAttachmentsResponseSchema,
  ZGetTemplateAttachmentsSchema,
  ZSetDocumentAttachmentsResponseSchema,
  ZSetDocumentAttachmentsSchema,
  ZSetTemplateAttachmentsResponseSchema,
  ZSetTemplateAttachmentsSchema,
} from './schema';

export const attachmentRouter = router({
  /**
   * @private
   */
  getDocumentAttachments: authenticatedProcedure
    .input(ZGetDocumentAttachmentsSchema)
    .output(ZGetDocumentAttachmentsResponseSchema)
    .query(async ({ input, ctx }) => {
      const { documentId } = input;
      const { user } = ctx;

      const attachments = await findDocumentAttachments({
        documentId,
        userId: user.id,
        teamId: ctx.teamId,
      });

      return attachments;
    }),
  /**
   * @private
   */
  setDocumentAttachments: authenticatedProcedure
    .input(ZSetDocumentAttachmentsSchema)
    .output(ZSetDocumentAttachmentsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, attachments } = input;

      const updatedAttachments = await setDocumentAttachments({
        documentId,
        attachments,
      });

      return updatedAttachments;
    }),

  /**
   * @private
   */
  getTemplateAttachments: authenticatedProcedure
    .input(ZGetTemplateAttachmentsSchema)
    .output(ZGetTemplateAttachmentsResponseSchema)
    .query(async ({ input, ctx }) => {
      const { templateId } = input;

      const attachments = await findTemplateAttachments({
        templateId,
        userId: ctx.user.id,
        teamId: ctx.teamId,
      });

      return attachments;
    }),
  /**
   * @private
   */
  setTemplateAttachments: authenticatedProcedure
    .input(ZSetTemplateAttachmentsSchema)
    .output(ZSetTemplateAttachmentsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { templateId, attachments } = input;

      const updatedAttachments = await setTemplateAttachments({
        templateId,
        attachments,
      });

      return updatedAttachments;
    }),
});
