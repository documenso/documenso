import { getEntireDocument } from '@documenso/lib/server-only/admin/get-entire-document';
import { sealDocument } from '@documenso/lib/server-only/document/seal-document';
import { isDocumentCompleted } from '@documenso/lib/utils/document';

import { adminProcedure } from '../trpc';
import {
  ZResealDocumentRequestSchema,
  ZResealDocumentResponseSchema,
} from './reseal-document.types';

export const resealDocumentRoute = adminProcedure
  .input(ZResealDocumentRequestSchema)
  .output(ZResealDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    const document = await getEntireDocument({ id });

    const isResealing = isDocumentCompleted(document.status);

    await sealDocument({ documentId: id, isResealing });
  });
