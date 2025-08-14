import type { DocumentStatus } from '@prisma/client';

import type { DateRange } from '@documenso/lib/types/search-params';
import { kyselyPrisma, sql } from '@documenso/prisma';

export type OrganisationSummary = {
  totalTeams: number;
  totalMembers: number;
  totalDocuments: number;
  activeDocuments: number;
  completedDocuments: number;
  volumeThisPeriod: number;
  volumeAllTime: number;
};

export type OrganisationDetailedInsights = {
  teams: TeamInsights[];
  users: UserInsights[];
  documents: DocumentInsights[];
  totalPages: number;
  summary?: OrganisationSummary;
};

export type TeamInsights = {
  id: number;
  name: string;
  memberCount: number;
  documentCount: number;
  createdAt: Date;
};

export type UserInsights = {
  id: number;
  name: string;
  email: string;
  documentCount: number;
  signedDocumentCount: number;
  createdAt: Date;
};

export type DocumentInsights = {
  id: string;
  title: string;
  status: DocumentStatus;
  teamName: string;
  createdAt: Date;
  completedAt: Date | null;
};

export type GetOrganisationDetailedInsightsOptions = {
  organisationId: string;
  page?: number;
  perPage?: number;
  dateRange?: DateRange;
  view: 'teams' | 'users' | 'documents';
};

export async function getOrganisationDetailedInsights({
  organisationId,
  page = 1,
  perPage = 10,
  dateRange = 'last30days',
  view,
}: GetOrganisationDetailedInsightsOptions): Promise<OrganisationDetailedInsights> {
  const offset = Math.max(page - 1, 0) * perPage;

  const now = new Date();
  let createdAtFrom: Date | null = null;

  switch (dateRange) {
    case 'last30days': {
      createdAtFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    }
    case 'last90days': {
      createdAtFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    }
    case 'lastYear': {
      createdAtFrom = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    }
    case 'allTime':
    default:
      createdAtFrom = null;
      break;
  }

  const summaryData = await getOrganisationSummary(organisationId, createdAtFrom);

  const viewData = await (async () => {
    switch (view) {
      case 'teams':
        return await getTeamInsights(organisationId, offset, perPage, createdAtFrom);
      case 'users':
        return await getUserInsights(organisationId, offset, perPage, createdAtFrom);
      case 'documents':
        return await getDocumentInsights(organisationId, offset, perPage, createdAtFrom);
      default:
        throw new Error(`Invalid view: ${view}`);
    }
  })();

  return {
    ...viewData,
    summary: summaryData,
  };
}

async function getTeamInsights(
  organisationId: string,
  offset: number,
  perPage: number,
  createdAtFrom: Date | null,
): Promise<OrganisationDetailedInsights> {
  const teamsQuery = kyselyPrisma.$kysely
    .selectFrom('Team as t')
    .leftJoin('Document as d', (join) =>
      join.onRef('t.id', '=', 'd.teamId').on('d.deletedAt', 'is', null),
    )
    .leftJoin('TeamGroup as tg', 'tg.teamId', 't.id')
    .leftJoin('OrganisationGroup as og', 'og.id', 'tg.organisationGroupId')
    .leftJoin('OrganisationGroupMember as ogm', 'ogm.groupId', 'og.id')
    .leftJoin('OrganisationMember as om', 'om.id', 'ogm.organisationMemberId')
    .where('t.organisationId', '=', organisationId)
    .select([
      't.id as id',
      't.name as name',
      't.createdAt as createdAt',
      sql<number>`COUNT(DISTINCT om."userId")`.as('memberCount'),
      (createdAtFrom
        ? sql<number>`COUNT(DISTINCT CASE WHEN d.id IS NOT NULL AND d."createdAt" >= ${createdAtFrom} THEN d.id END)`
        : sql<number>`COUNT(DISTINCT d.id)`
      ).as('documentCount'),
    ])
    .groupBy(['t.id', 't.name', 't.createdAt'])
    .orderBy('documentCount', 'desc')
    .limit(perPage)
    .offset(offset);

  const countQuery = kyselyPrisma.$kysely
    .selectFrom('Team as t')
    .where('t.organisationId', '=', organisationId)
    .select(({ fn }) => [fn.countAll().as('count')]);

  const [teams, countResult] = await Promise.all([teamsQuery.execute(), countQuery.execute()]);
  const count = Number(countResult[0]?.count || 0);

  return {
    teams: teams as TeamInsights[],
    users: [],
    documents: [],
    totalPages: Math.ceil(Number(count) / perPage),
  };
}

async function getUserInsights(
  organisationId: string,
  offset: number,
  perPage: number,
  createdAtFrom: Date | null,
): Promise<OrganisationDetailedInsights> {
  const usersBase = kyselyPrisma.$kysely
    .selectFrom('OrganisationMember as om')
    .innerJoin('User as u', 'u.id', 'om.userId')
    .where('om.organisationId', '=', organisationId)
    .leftJoin('Document as d', (join) =>
      join.onRef('d.userId', '=', 'u.id').on('d.deletedAt', 'is', null),
    )
    .leftJoin('Team as td', (join) =>
      join.onRef('td.id', '=', 'd.teamId').on('td.organisationId', '=', organisationId),
    )
    .leftJoin('Recipient as r', (join) =>
      join.onRef('r.email', '=', 'u.email').on('r.signedAt', 'is not', null),
    )
    .leftJoin('Document as sd', (join) =>
      join.onRef('sd.id', '=', 'r.documentId').on('sd.deletedAt', 'is', null),
    )
    .leftJoin('Team as ts', (join) =>
      join.onRef('ts.id', '=', 'sd.teamId').on('ts.organisationId', '=', organisationId),
    );

  const usersQuery = usersBase
    .select([
      'u.id as id',
      'u.name as name',
      'u.email as email',
      'u.createdAt as createdAt',
      (createdAtFrom
        ? sql<number>`COUNT(DISTINCT CASE WHEN d.id IS NOT NULL AND td.id IS NOT NULL AND d."createdAt" >= ${createdAtFrom} THEN d.id END)`
        : sql<number>`COUNT(DISTINCT CASE WHEN td.id IS NOT NULL THEN d.id END)`
      ).as('documentCount'),
      (createdAtFrom
        ? sql<number>`COUNT(DISTINCT CASE WHEN r.id IS NOT NULL AND ts.id IS NOT NULL AND r."signedAt" >= ${createdAtFrom} AND r.role = 'SIGNER'::"RecipientRole" THEN r.id END)`
        : sql<number>`COUNT(DISTINCT CASE WHEN ts.id IS NOT NULL AND r.role = 'SIGNER'::"RecipientRole" THEN r.id END)`
      ).as('signedDocumentCount'),
    ])
    .groupBy(['u.id', 'u.name', 'u.email', 'u.createdAt'])
    .orderBy('u.createdAt', 'desc')
    .limit(perPage)
    .offset(offset);

  const countQuery = kyselyPrisma.$kysely
    .selectFrom('OrganisationMember as om')
    .innerJoin('User as u', 'u.id', 'om.userId')
    .where('om.organisationId', '=', organisationId)
    .select(({ fn }) => [fn.countAll().as('count')]);

  const [users, countResult] = await Promise.all([usersQuery.execute(), countQuery.execute()]);
  const count = Number(countResult[0]?.count || 0);

  return {
    teams: [],
    users: users as UserInsights[],
    documents: [],
    totalPages: Math.ceil(Number(count) / perPage),
  };
}

async function getDocumentInsights(
  organisationId: string,
  offset: number,
  perPage: number,
  createdAtFrom: Date | null,
): Promise<OrganisationDetailedInsights> {
  let documentsQuery = kyselyPrisma.$kysely
    .selectFrom('Document as d')
    .innerJoin('Team as t', 'd.teamId', 't.id')
    .where('t.organisationId', '=', organisationId)
    .where('d.deletedAt', 'is', null);

  if (createdAtFrom) {
    documentsQuery = documentsQuery.where('d.createdAt', '>=', createdAtFrom);
  }

  documentsQuery = documentsQuery
    .select([
      'd.id as id',
      'd.title as title',
      'd.status as status',
      'd.createdAt as createdAt',
      'd.completedAt as completedAt',
      't.name as teamName',
    ])
    .orderBy('d.createdAt', 'desc')
    .limit(perPage)
    .offset(offset);

  let countQuery = kyselyPrisma.$kysely
    .selectFrom('Document as d')
    .innerJoin('Team as t', 'd.teamId', 't.id')
    .where('t.organisationId', '=', organisationId)
    .where('d.deletedAt', 'is', null);

  if (createdAtFrom) {
    countQuery = countQuery.where('d.createdAt', '>=', createdAtFrom);
  }

  countQuery = countQuery.select(({ fn }) => [fn.countAll().as('count')]);

  const [documents, countResult] = await Promise.all([
    documentsQuery.execute(),
    countQuery.execute(),
  ]);

  const count = Number((countResult[0] as { count: number })?.count || 0);

  return {
    teams: [],
    users: [],
    documents: documents.map((doc) => ({
      ...doc,
      id: String((doc as { id: number }).id),
    })) as DocumentInsights[],
    totalPages: Math.ceil(Number(count) / perPage),
  };
}

async function getOrganisationSummary(
  organisationId: string,
  createdAtFrom: Date | null,
): Promise<OrganisationSummary> {
  const summaryQuery = kyselyPrisma.$kysely
    .selectFrom('Organisation as o')
    .where('o.id', '=', organisationId)
    .select([
      sql<number>`(SELECT COUNT(DISTINCT t2.id) FROM "Team" AS t2 WHERE t2."organisationId" = o.id)`.as(
        'totalTeams',
      ),
      sql<number>`(SELECT COUNT(DISTINCT om2."userId") FROM "OrganisationMember" AS om2 WHERE om2."organisationId" = o.id)`.as(
        'totalMembers',
      ),
      sql<number>`(
        SELECT COUNT(DISTINCT d2.id)
        FROM "Document" AS d2
        INNER JOIN "Team" AS t2 ON t2.id = d2."teamId"
        WHERE t2."organisationId" = o.id AND d2."deletedAt" IS NULL
      )`.as('totalDocuments'),
      sql<number>`(
        SELECT COUNT(DISTINCT d2.id)
        FROM "Document" AS d2
        INNER JOIN "Team" AS t2 ON t2.id = d2."teamId"
        WHERE t2."organisationId" = o.id AND d2."deletedAt" IS NULL AND d2.status IN ('DRAFT', 'PENDING')
      )`.as('activeDocuments'),
      sql<number>`(
        SELECT COUNT(DISTINCT d2.id)
        FROM "Document" AS d2
        INNER JOIN "Team" AS t2 ON t2.id = d2."teamId"
        WHERE t2."organisationId" = o.id AND d2."deletedAt" IS NULL AND d2.status = 'COMPLETED'
      )`.as('completedDocuments'),
      (createdAtFrom
        ? sql<number>`(
            SELECT COUNT(DISTINCT d2.id)
            FROM "Document" AS d2
            INNER JOIN "Team" AS t2 ON t2.id = d2."teamId"
            WHERE t2."organisationId" = o.id
              AND d2."deletedAt" IS NULL
              AND d2.status = 'COMPLETED'
              AND d2."createdAt" >= ${createdAtFrom}
          )`
        : sql<number>`(
            SELECT COUNT(DISTINCT d2.id)
            FROM "Document" AS d2
            INNER JOIN "Team" AS t2 ON t2.id = d2."teamId"
            WHERE t2."organisationId" = o.id
              AND d2."deletedAt" IS NULL
              AND d2.status = 'COMPLETED'
          )`
      ).as('volumeThisPeriod'),
      sql<number>`(
        SELECT COUNT(DISTINCT d2.id)
        FROM "Document" AS d2
        INNER JOIN "Team" AS t2 ON t2.id = d2."teamId"
        WHERE t2."organisationId" = o.id AND d2."deletedAt" IS NULL AND d2.status = 'COMPLETED'
      )`.as('volumeAllTime'),
    ]);

  const result = await summaryQuery.executeTakeFirst();

  return {
    totalTeams: Number(result?.totalTeams || 0),
    totalMembers: Number(result?.totalMembers || 0),
    totalDocuments: Number(result?.totalDocuments || 0),
    activeDocuments: Number(result?.activeDocuments || 0),
    completedDocuments: Number(result?.completedDocuments || 0),
    volumeThisPeriod: Number(result?.volumeThisPeriod || 0),
    volumeAllTime: Number(result?.volumeAllTime || 0),
  };
}
