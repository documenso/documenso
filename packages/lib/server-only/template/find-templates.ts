import { DocumentVisibility, type Prisma, TeamMemberRole, type Template } from '@prisma/client';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { type FindResultResponse } from '../../types/search-params';
import { getMemberRoles } from '../team/get-member-roles';

export type FindTemplatesOptions = {
  userId: number;
  teamId: number;
  type?: Template['type'];
  page?: number;
  perPage?: number;
  folderId?: string;
};

export const findTemplates = async ({
  userId,
  teamId,
  type,
  page = 1,
  perPage = 10,
  folderId,
}: FindTemplatesOptions) => {
  const whereFilter: Prisma.TemplateWhereInput[] = [];

  if (teamId === undefined) {
    whereFilter.push({ userId });
  }

  if (teamId !== undefined) {
    const { teamRole } = await getMemberRoles({
      teamId,
      reference: {
        type: 'User',
        id: userId,
      },
    });

    whereFilter.push(
      { teamId },
      {
        OR: [
          match(teamRole)
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
          { userId, teamId },
        ],
      },
    );
  }

  if (folderId) {
    whereFilter.push({ folderId });
  } else {
    whereFilter.push({ folderId: null });
  }

  const [data, count] = await Promise.all([
    prisma.template.findMany({
      where: {
        type,
        AND: whereFilter,
      },
      include: {
        team: {
          select: {
            id: true,
            url: true,
          },
        },
        fields: true,
        recipients: true,
        templateMeta: true,
        directLink: {
          select: {
            token: true,
            enabled: true,
          },
        },
      },
      skip: Math.max(page - 1, 0) * perPage,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.template.count({
      where: {
        AND: whereFilter,
      },
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
