import { findEnvelopes } from '@documenso/lib/server-only/envelope/find-envelopes';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindEnvelopesRequestSchema,
  ZFindEnvelopesResponseSchema,
  findEnvelopesMeta,
} from './find-envelopes.types';

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
      folderId,
    } = input;

    ctx.logger.info({
      input: {
        query,
        type,
        templateId,
        source,
        status,
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
      page,
      perPage,
      folderId,
      orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
    });
  });
