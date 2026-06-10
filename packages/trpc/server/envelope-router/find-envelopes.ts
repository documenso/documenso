import { findEnvelopes } from '@documenso/lib/server-only/envelope/find-envelopes';

import { authenticatedProcedure } from '../trpc';
import { findEnvelopesMeta, ZFindEnvelopesRequestSchema, ZFindEnvelopesResponseSchema } from './find-envelopes.types';

export const findEnvelopesRoute = authenticatedProcedure
  .meta(findEnvelopesMeta)
  .input(ZFindEnvelopesRequestSchema)
  .output(ZFindEnvelopesResponseSchema)
  .query(async ({ input, ctx }) => {
    const { user, teamId } = ctx;

    const {
      query,
      type,
      templateId,
      page,
      perPage,
      orderByDirection,
      orderByColumn,
      source,
      status,
      hasExpiredRecipients,
      folderId,
    } = input;

    ctx.logger.info({
      input: {
        query,
        type,
        templateId,
        source,
        status,
        hasExpiredRecipients,
        folderId,
        page,
        perPage,
      },
    });

    return await findEnvelopes({
      userId: user.id,
      teamId,
      type,
      templateId,
      query,
      source,
      status,
      hasExpiredRecipients,
      page,
      perPage,
      folderId,
      orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
      useWindowedCount: false,
    });
  });
