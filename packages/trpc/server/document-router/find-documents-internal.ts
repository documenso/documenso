import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import type { GetStatsInput } from '@documenso/lib/server-only/document/get-stats';
import { getStats } from '@documenso/lib/server-only/document/get-stats';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindDocumentsInternalRequestSchema,
  ZFindDocumentsInternalResponseSchema,
} from './find-documents-internal.types';

export const findDocumentsInternalRoute = authenticatedProcedure
  .input(ZFindDocumentsInternalRequestSchema)
  .output(ZFindDocumentsInternalResponseSchema)
  .query(async ({ input, ctx }) => {
    const { user, teamId } = ctx;

    const {
      query,
      templateId,
      page,
      perPage,
      orderByDirection,
      orderByColumn,
      source,
      status,
      period,
      senderIds,
      folderId,
    } = input;

    const getStatOptions: GetStatsInput = {
      user,
      period,
      search: query,
      folderId,
    };

    if (teamId) {
      const team = await getTeamById({ userId: user.id, teamId });

      getStatOptions.team = {
        teamId: team.id,
        teamEmail: team.teamEmail?.email,
        senderIds,
        currentTeamMemberRole: team.currentTeamRole,
        currentUserEmail: user.email,
        userId: user.id,
      };
    }

    const [stats, documents] = await Promise.all([
      getStats(getStatOptions),
      findDocuments({
        userId: user.id,
        teamId,
        query,
        templateId,
        page,
        perPage,
        source,
        status,
        period,
        senderIds,
        folderId,
        orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
      }),
    ]);

    return {
      ...documents,
      stats,
    };
  });
