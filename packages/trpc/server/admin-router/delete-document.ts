import { sendDeleteEmail } from '@documenso/lib/server-only/document/send-delete-email';
import { superDeleteDocument } from '@documenso/lib/server-only/document/super-delete-document';

import { adminProcedure } from '../trpc';
import {
  ZDeleteDocumentRequestSchema,
  ZDeleteDocumentResponseSchema,
} from './delete-document.types';

export const deleteDocumentRoute = adminProcedure
  .input(ZDeleteDocumentRequestSchema)
  .output(ZDeleteDocumentResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { id, reason } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    await sendDeleteEmail({ documentId: id, reason });

    await superDeleteDocument({
      id,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  });
