import type { DocumentStatus } from '@prisma/client';

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
  dateRange?: 'last30days' | 'last90days' | 'lastYear' | 'allTime';
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

  let dateFilter = sql``;
  const now = new Date();

  switch (dateRange) {
    case 'last30days': {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = sql`AND d."createdAt" >= ${thirtyDaysAgo}`;
      break;
    }
    case 'last90days': {
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      dateFilter = sql`AND d."createdAt" >= ${ninetyDaysAgo}`;
      break;
    }
    case 'lastYear': {
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      dateFilter = sql`AND d."createdAt" >= ${oneYearAgo}`;
      break;
    }
    case 'allTime':
    default:
      dateFilter = sql``;
      break;
  }

  // Get organisation summary metrics
  const summaryData = await getOrganisationSummary(organisationId, dateFilter);

  const viewData = await (async () => {
    switch (view) {
      case 'teams':
        return await getTeamInsights(organisationId, offset, perPage, dateFilter);
      case 'users':
        return await getUserInsights(organisationId, offset, perPage, dateFilter);
      case 'documents':
        return await getDocumentInsights(organisationId, offset, perPage, dateFilter);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dateFilter: any,
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
      sql<number>`COUNT(DISTINCT CASE WHEN d.id IS NOT NULL ${dateFilter} THEN d.id END)`.as(
        'documentCount',
      ),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, unused-imports/no-unused-vars
  _dateFilter: any,
): Promise<OrganisationDetailedInsights> {
  const usersQuery = kyselyPrisma.$kysely
    .selectFrom('OrganisationMember as om')
    .innerJoin('User as u', 'u.id', 'om.userId')
    .leftJoin('Document as d', (join) =>
      join.onRef('d.userId', '=', 'u.id').on('d.deletedAt', 'is', null),
    )
    .leftJoin('Recipient as r', (join) =>
      join.onRef('r.email', '=', 'u.email').on('r.signedAt', 'is not', null),
    )
    .where('om.organisationId', '=', organisationId)
    .select([
      'u.id as id',
      'u.name as name',
      'u.email as email',
      'u.createdAt as createdAt',
      sql<number>`COUNT(DISTINCT d.id)`.as('documentCount'),
      sql<number>`COUNT(DISTINCT r.id)`.as('signedDocumentCount'),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dateFilter: any,
): Promise<OrganisationDetailedInsights> {
  let documentsQuery = kyselyPrisma.$kysely
    .selectFrom('Document as d')
    .innerJoin('Team as t', 'd.teamId', 't.id')
    .where('t.organisationId', '=', organisationId)
    .where('d.deletedAt', 'is', null);

  // Apply date filter if it's not empty (which means all time)
  if (dateFilter && dateFilter.sql && dateFilter.sql !== '') {
    documentsQuery = documentsQuery.where(sql`${dateFilter}`);
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

  // Apply same date filter to count query
  if (dateFilter && dateFilter.sql && dateFilter.sql !== '') {
    countQuery = countQuery.where(sql`${dateFilter}`);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dateFilter: any,
): Promise<OrganisationSummary> {
  const summaryQuery = kyselyPrisma.$kysely
    .selectFrom('Organisation as o')
    .leftJoin('Team as t', 'o.id', 't.organisationId')
    .leftJoin('OrganisationMember as om', 'o.id', 'om.organisationId')
    .leftJoin('Document as d', (join) =>
      join.onRef('t.id', '=', 'd.teamId').on('d.deletedAt', 'is', null),
    )
    .where('o.id', '=', organisationId)
    .select([
      sql<number>`COUNT(DISTINCT t.id)`.as('totalTeams'),
      sql<number>`COUNT(DISTINCT om."userId")`.as('totalMembers'),
      sql<number>`COUNT(DISTINCT d.id)`.as('totalDocuments'),
      sql<number>`COUNT(DISTINCT CASE WHEN d.status IN ('DRAFT', 'PENDING') THEN d.id END)`.as(
        'activeDocuments',
      ),
      sql<number>`COUNT(DISTINCT CASE WHEN d.status = 'COMPLETED' THEN d.id END)`.as(
        'completedDocuments',
      ),
      sql<number>`COUNT(DISTINCT CASE WHEN d.id IS NOT NULL AND d.status = 'COMPLETED' ${dateFilter} THEN d.id END)`.as(
        'volumeThisPeriod',
      ),
      sql<number>`COUNT(DISTINCT CASE WHEN d.status = 'COMPLETED' THEN d.id END)`.as(
        'volumeAllTime',
      ),
    ]);

  const result = await summaryQuery.executeTakeFirst();

  return {
    totalTeams: Math.max(Number(result?.totalTeams || 0), 1),
    totalMembers: Number(result?.totalMembers || 0),
    totalDocuments: Number(result?.totalDocuments || 0),
    activeDocuments: Number(result?.activeDocuments || 0),
    completedDocuments: Number(result?.completedDocuments || 0),
    volumeThisPeriod: Number(result?.volumeThisPeriod || 0),
    volumeAllTime: Number(result?.volumeAllTime || 0),
  };
}
