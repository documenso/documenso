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

  // Find all unique customerIds from both personal and team subscriptions
  const activeCustomerIds = await prisma.$queryRaw<{ customerId: string }[]>`
    SELECT DISTINCT "customerId"
    FROM (
      -- Get customerIds from users with active subscriptions
      SELECT u."customerId"
      FROM "User" u
      JOIN "Subscription" s ON u.id = s."userId"
      WHERE s.status = 'ACTIVE' AND u."customerId" IS NOT NULL
      
      UNION
      
      -- Get customerIds from teams with active subscriptions
      SELECT t."customerId"
      FROM "Team" t
      JOIN "Subscription" s ON t.id = s."teamId"
      WHERE s.status = 'ACTIVE' AND t."customerId" IS NOT NULL
    ) AS active_customers
    ${search ? Prisma.sql`WHERE "customerId" LIKE ${`%${search}%`}` : Prisma.empty}
  `;

  const totalCustomerCount = activeCustomerIds.length;

  const paginatedCustomerIds = activeCustomerIds.slice(skip, skip + perPage);

  const customerData = await Promise.all(
    paginatedCustomerIds.map(async ({ customerId }) => {
      const users = await prisma.user.findMany({
        where: { customerId },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      });

      const teams = await prisma.team.findMany({
        where: { customerId },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      });

      const userDocumentCount = await prisma.document.count({
        where: {
          userId: { in: users.map((user) => user.id) },
          status: DocumentStatus.COMPLETED,
        },
      });

      const teamDocumentCount = await prisma.document.count({
        where: {
          teamId: { in: teams.map((team) => team.id) },
          status: DocumentStatus.COMPLETED,
        },
      });

      const subscription = await prisma.subscription.findFirst({
        where: {
          OR: [{ user: { customerId } }, { team: { customerId } }],
          status: SubscriptionStatus.ACTIVE,
        },
        select: {
          planId: true,
        },
      });

      const displayName = users[0]?.name || teams[0]?.name || customerId;

      const creationDates = [
        ...users.map((user) => user.createdAt),
        ...teams.map((team) => team.createdAt),
      ].filter(Boolean);

      const createdAt =
        creationDates.length > 0
          ? new Date(Math.min(...creationDates.map((date) => date.getTime())))
          : new Date();

      return {
        id: users[0]?.id || teams[0]?.id || 0,
        customerId,
        name: displayName,
        signingVolume: userDocumentCount + teamDocumentCount,
        createdAt,
        planId: subscription?.planId || '',
      };
    }),
  );

  // Sort the results by the requested sort criteria
  const sortedResults = [...customerData];

  if (sortBy === 'name') {
    sortedResults.sort((a, b) => {
      return sortOrder === 'desc'
        ? (b.name || '').localeCompare(a.name || '')
        : (a.name || '').localeCompare(b.name || '');
    });
  } else if (sortBy === 'createdAt') {
    sortedResults.sort((a, b) => {
      return sortOrder === 'desc'
        ? b.createdAt.getTime() - a.createdAt.getTime()
        : a.createdAt.getTime() - b.createdAt.getTime();
    });
  } else if (sortBy === 'signingVolume') {
    sortedResults.sort((a, b) => {
      return sortOrder === 'desc'
        ? b.signingVolume - a.signingVolume
        : a.signingVolume - b.signingVolume;
    });
  }

  return {
    leaderboard: sortedResults,
    totalPages: Math.ceil(totalCustomerCount / perPage),
  };
}
