import { adminSuperDeleteDocument } from '@documenso/lib/server-only/admin/admin-super-delete-document';

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

    await adminSuperDeleteDocument({
      envelopeId: id,
      reason,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  });
