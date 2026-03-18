import { EnvelopeType, type Prisma, TemplateType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { type FindResultResponse } from '../../types/search-params';
import { getMemberRoles } from '../team/get-member-roles';
import { getTeamById } from '../team/get-team';

export type FindOrganisationTemplatesOptions = {
  userId: number;
  teamId: number;
  page?: number;
  perPage?: number;
};

export const findOrganisationTemplates = async ({
  userId,
  teamId,
  page = 1,
  perPage = 10,
}: FindOrganisationTemplatesOptions) => {
  const [team, { teamRole }] = await Promise.all([
    getTeamById({ teamId, userId }),
    getMemberRoles({
      teamId,
      reference: {
        type: 'User',
        id: userId,
      },
    }),
  ]);

  const where: Prisma.EnvelopeWhereInput = {
    type: EnvelopeType.TEMPLATE,
    templateType: TemplateType.ORGANISATION,
    visibility: {
      in: TEAM_DOCUMENT_VISIBILITY_MAP[teamRole],
    },
    team: {
      organisationId: team.organisationId,
    },
  };

  const templateInclude = {
    team: {
      select: {
        id: true,
        url: true,
        name: true,
      },
    },
    fields: true,
    recipients: true,
    documentMeta: true,
    directLink: {
      select: {
        token: true,
        enabled: true,
      },
    },
  } as const;

  const [data, count] = await Promise.all([
    prisma.envelope.findMany({
      where,
      include: templateInclude,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.envelope.count({ where }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
