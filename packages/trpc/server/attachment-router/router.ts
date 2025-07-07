import { findAttachments } from '@documenso/lib/server-only/attachment/find-attachments';
import { setDocumentAttachments } from '@documenso/lib/server-only/attachment/set-document-attachments';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZGetDocumentAttachmentsResponseSchema,
  ZGetDocumentAttachmentsSchema,
  ZSetDocumentAttachmentsResponseSchema,
  ZSetDocumentAttachmentsSchema,
} from './schema';

export const attachmentRouter = router({
  /**
   * @private
   */
  getAttachments: authenticatedProcedure
    .input(ZGetDocumentAttachmentsSchema)
    .output(ZGetDocumentAttachmentsResponseSchema)
    .query(async ({ input, ctx }) => {
      const { documentId } = input;
      const { user } = ctx;

      const attachments = await findAttachments({
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
});
