import { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';
import { DocumentStatus, SubscriptionStatus } from '@documenso/prisma/client';

export type SigningVolume = {
  id: number;
  name: string;
  signingVolume: number;
  createdAt: Date;
  planId: string;
};

export type GetSigningVolumeOptions = {
  search?: string;
  page?: number;
  perPage?: number;
  sortBy?: 'name' | 'createdAt' | 'signingVolume';
  sortOrder?: 'asc' | 'desc';
};

export async function getSigningVolume({
  search = '',
  page = 1,
  perPage = 10,
  sortBy = 'signingVolume',
  sortOrder = 'desc',
}: GetSigningVolumeOptions) {
  const skip = (page - 1) * perPage;

  const baseUserQuery = {
    OR: [
      {
        subscriptions: {
          some: {
            status: SubscriptionStatus.ACTIVE,
          },
        },
      },
      {
        teamMembers: {
          some: {
            team: {
              subscription: {
                status: SubscriptionStatus.ACTIVE,
              },
            },
          },
        },
      },
    ],
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
  };

  const results = await prisma.user.findMany({
    where: baseUserQuery,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: {
        select: {
          documents: {
            where: {
              status: DocumentStatus.COMPLETED,
            },
          },
        },
      },
      teamMembers: {
        select: {
          team: {
            select: {
              documents: {
                where: {
                  status: DocumentStatus.COMPLETED,
                },
              },
            },
          },
        },
      },
    },
    skip,
    take: perPage,
    orderBy: [
      ...(sortBy === 'name'
        ? [{ name: sortOrder }]
        : sortBy === 'createdAt'
          ? [{ createdAt: sortOrder }]
          : []),
    ],
  });

  const count = await prisma.user.count({
    where: baseUserQuery,
  });

  const transformedResults = results.map((user) => {
    const personalDocuments = user._count.documents;

    const teamDocuments = user.teamMembers.reduce(
      (acc, member) => acc + member.team.documents.length,
      0,
    );

    const signingVolume = personalDocuments + teamDocuments;

    return {
      id: user.id,
      name: user.name,
      signingVolume,
      createdAt: user.createdAt,
      planId: '',
    };
  });

  if (sortBy === 'signingVolume') {
    transformedResults.sort((a, b) => {
      return sortOrder === 'desc'
        ? b.signingVolume - a.signingVolume
        : a.signingVolume - b.signingVolume;
    });
  }

  return {
    leaderboard: transformedResults,
    totalPages: Math.ceil(count / perPage),
  };
}
