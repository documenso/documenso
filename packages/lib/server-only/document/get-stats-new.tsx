import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

import {
  type PeriodSelectorValue,
  findDocumentsFilter,
  findTeamDocumentsFilter,
} from '@documenso/lib/server-only/document/find-documents';
import { prisma } from '@documenso/prisma';
import type { Prisma, Team, TeamEmail, User } from '@documenso/prisma/client';
import { DocumentVisibility, TeamMemberRole } from '@documenso/prisma/client';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

export type GetStatsInput = {
  user: User;
  team?: Team & { teamEmail: TeamEmail | null } & { currentTeamMember?: { role: TeamMemberRole } };
  period?: PeriodSelectorValue;
  search?: string;
};

export const getStats = async ({ user, period, search, ...options }: GetStatsInput) => {
  let createdAt: Prisma.DocumentWhereInput['createdAt'];

  if (period) {
    const daysAgo = parseInt(period.replace(/d$/, ''), 10);

    const startOfPeriod = DateTime.now().minus({ days: daysAgo }).startOf('day');

    createdAt = {
      gte: startOfPeriod.toJSDate(),
    };
  }

  const stats: Record<ExtendedDocumentStatus, number> = {
    [ExtendedDocumentStatus.DRAFT]: 0,
    [ExtendedDocumentStatus.PENDING]: 0,
    [ExtendedDocumentStatus.COMPLETED]: 0,
    [ExtendedDocumentStatus.INBOX]: 0,
    [ExtendedDocumentStatus.ALL]: 0,
    [ExtendedDocumentStatus.BIN]: 0,
  };

  const searchFilter: Prisma.DocumentWhereInput = search
    ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { Recipient: { some: { name: { contains: search, mode: 'insensitive' } } } },
          { Recipient: { some: { email: { contains: search, mode: 'insensitive' } } } },
        ],
      }
    : {};

  const visibilityFilters = [
    match(options.team?.currentTeamMember?.role)
      .with(TeamMemberRole.ADMIN, () => ({
        visibility: {
          in: [
            DocumentVisibility.EVERYONE,
            DocumentVisibility.MANAGER_AND_ABOVE,
            DocumentVisibility.ADMIN,
          ],
        },
      }))
      .with(TeamMemberRole.MANAGER, () => ({
        visibility: {
          in: [DocumentVisibility.EVERYONE, DocumentVisibility.MANAGER_AND_ABOVE],
        },
      }))
      .otherwise(() => ({ visibility: DocumentVisibility.EVERYONE })),
  ];

  const statusCounts = await Promise.all(
    Object.values(ExtendedDocumentStatus).map(async (status) => {
      if (status === ExtendedDocumentStatus.ALL) {
        return;
      }

      const filter = options.team
        ? findTeamDocumentsFilter(status, options.team, visibilityFilters)
        : findDocumentsFilter(status, user);

      if (filter === null) {
        return { status, count: 0 };
      }

      const whereClause = {
        ...filter,
        ...(createdAt && { createdAt }),
        ...searchFilter,
      };

      const count = await prisma.document.count({
        where: whereClause,
      });

      return { status, count };
    }),
  );

  statusCounts.forEach((result) => {
    if (result) {
      stats[result.status] = result.count;
      if (
        result.status !== ExtendedDocumentStatus.BIN &&
        [
          ExtendedDocumentStatus.DRAFT,
          ExtendedDocumentStatus.PENDING,
          ExtendedDocumentStatus.COMPLETED,
          ExtendedDocumentStatus.INBOX,
        ].includes(result.status)
      ) {
        stats[ExtendedDocumentStatus.ALL] += result.count;
      }
    }
  });

  return stats;
};
