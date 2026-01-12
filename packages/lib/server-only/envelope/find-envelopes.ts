import type {
  DocumentSource,
  DocumentStatus,
  Envelope,
  EnvelopeType,
  Prisma,
} from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import type { FindResultResponse } from '../../types/search-params';
import { maskRecipientTokensForDocument } from '../../utils/mask-recipient-tokens-for-document';
import { getTeamById } from '../team/get-team';

export type FindEnvelopesOptions = {
  userId: number;
  teamId: number;
  type?: EnvelopeType;
  templateId?: number;
  source?: DocumentSource;
  status?: DocumentStatus;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Pick<Envelope, 'createdAt'>;
    direction: 'asc' | 'desc';
  };
  query?: string;
  folderId?: string;
};

export const findEnvelopes = async ({
  userId,
  teamId,
  type,
  templateId,
  source,
  status,
  page = 1,
  perPage = 10,
  orderBy,
  query = '',
  folderId,
}: FindEnvelopesOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  const team = await getTeamById({
    userId,
    teamId,
  });

  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const searchFilter: Prisma.EnvelopeWhereInput = query
    ? {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { externalId: { contains: query, mode: 'insensitive' } },
          { recipients: { some: { name: { contains: query, mode: 'insensitive' } } } },
          { recipients: { some: { email: { contains: query, mode: 'insensitive' } } } },
        ],
      }
    : {};

  const visibilityFilter: Prisma.EnvelopeWhereInput = {
    visibility: {
      in: TEAM_DOCUMENT_VISIBILITY_MAP[team.currentTeamRole],
    },
  };

  const teamEmailFilters: Prisma.EnvelopeWhereInput[] = [];

  if (team.teamEmail) {
    teamEmailFilters.push(
      {
        user: {
          email: team.teamEmail.email,
        },
      },
      {
        recipients: {
          some: {
            email: team.teamEmail.email,
          },
        },
      },
    );
  }

  const whereClause: Prisma.EnvelopeWhereInput = {
    AND: [
      {
        OR: [
          {
            teamId: team.id,
            ...visibilityFilter,
          },
          {
            userId,
          },
          ...teamEmailFilters,
        ],
      },
      {
        folderId: folderId ?? null,
        deletedAt: null,
      },
      searchFilter,
    ],
  };

  if (type) {
    whereClause.type = type;
  }

  if (templateId) {
    whereClause.templateId = templateId;
  }

  if (source) {
    whereClause.source = source;
  }

  if (status) {
    whereClause.status = status;
  }

  const [data, count] = await Promise.all([
    prisma.envelope.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recipients: {
          orderBy: {
            id: 'asc',
          },
        },
        team: {
          select: {
            id: true,
            url: true,
          },
        },
      },
    }),
    prisma.envelope.count({
      where: whereClause,
    }),
  ]);

  const maskedData = data.map((envelope) =>
    maskRecipientTokensForDocument({
      document: envelope,
      user,
    }),
  );

  const mappedData = maskedData.map((envelope) => ({
    ...envelope,
    recipients: envelope.Recipient,
    user: {
      id: envelope.user.id,
      name: envelope.user.name || '',
      email: envelope.user.email,
    },
  }));

  return {
    data: mappedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof mappedData>;
};
