import { findTemplates } from '@documenso/lib/server-only/template/find-templates';
import { mapEnvelopeToTemplateMany } from '@documenso/lib/utils/templates';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindTemplatesInternalRequestSchema,
  ZFindTemplatesInternalResponseSchema,
} from './find-templates-internal.types';

export const findTemplatesInternalRoute = authenticatedProcedure
  .input(ZFindTemplatesInternalRequestSchema)
  .output(ZFindTemplatesInternalResponseSchema)
  .query(async ({ input, ctx }) => {
    const { user, teamId } = ctx;

    const { query, type, folderId, page, perPage, ownerIds } = input;

    ctx.logger.info({
      input: {
        folderId,
      },
    });

    const result = await findTemplates({
      userId: user.id,
      teamId,
      query,
      type,
      folderId,
      page,
      perPage,
      ownerIds,
    });

    return {
      ...result,
      data: result.data.map((envelope) => mapEnvelopeToTemplateMany(envelope)),
    };
  });
