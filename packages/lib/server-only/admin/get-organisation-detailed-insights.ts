import type { DocumentStatus } from '@prisma/client';
import { EnvelopeType } from '@prisma/client';

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
    .where('t.organisationId', '=', organisationId)
    .select((eb) => [
      't.id',
      't.name',
      't.createdAt',
      eb
        .selectFrom('TeamGroup as tg')
        .innerJoin('OrganisationGroup as og', 'og.id', 'tg.organisationGroupId')
        .innerJoin('OrganisationGroupMember as ogm', 'ogm.groupId', 'og.id')
        .innerJoin('OrganisationMember as om', 'om.id', 'ogm.organisationMemberId')
        .whereRef('tg.teamId', '=', 't.id')
        .select(sql<number>`count(distinct om."userId")`.as('count'))
        .as('memberCount'),
      eb
        .selectFrom('Envelope as e')
        .whereRef('e.teamId', '=', 't.id')
        .where('e.deletedAt', 'is', null)
        .where('e.type', '=', sql.lit(EnvelopeType.DOCUMENT))
        .$if(!!createdAtFrom, (qb) => qb.where('e.createdAt', '>=', createdAtFrom!))
        .select(sql<number>`count(e.id)`.as('count'))
        .as('documentCount'),
    ])
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
  const usersQuery = kyselyPrisma.$kysely
    .selectFrom('OrganisationMember as om')
    .innerJoin('User as u', 'u.id', 'om.userId')
    .where('om.organisationId', '=', organisationId)
    .select((eb) => [
      'u.id',
      'u.name',
      'u.email',
      'u.createdAt',
      eb
        .selectFrom('Envelope as e')
        .innerJoin('Team as t', 't.id', 'e.teamId')
        .whereRef('e.userId', '=', 'u.id')
        .where('t.organisationId', '=', organisationId)
        .where('e.deletedAt', 'is', null)
        .where('e.type', '=', sql.lit(EnvelopeType.DOCUMENT))
        .$if(!!createdAtFrom, (qb) => qb.where('e.createdAt', '>=', createdAtFrom!))
        .select(sql<number>`count(e.id)`.as('count'))
        .as('documentCount'),
      eb
        .selectFrom('Recipient as r')
        .innerJoin('Envelope as e', 'e.id', 'r.envelopeId')
        .innerJoin('Team as t', 't.id', 'e.teamId')
        .whereRef('r.email', '=', 'u.email')
        .where('r.signedAt', 'is not', null)
        .where('t.organisationId', '=', organisationId)
        .where('e.deletedAt', 'is', null)
        .where('e.type', '=', sql.lit(EnvelopeType.DOCUMENT))
        .$if(!!createdAtFrom, (qb) => qb.where('e.createdAt', '>=', createdAtFrom!))
        .select(sql<number>`count(e.id)`.as('count'))
        .as('signedDocumentCount'),
    ])
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
    .selectFrom('Envelope as e')
    .innerJoin('Team as t', 'e.teamId', 't.id')
    .where('t.organisationId', '=', organisationId)
    .where('e.deletedAt', 'is', null)
    .where(() => sql`e.type = ${EnvelopeType.DOCUMENT}::"EnvelopeType"`);

  if (createdAtFrom) {
    documentsQuery = documentsQuery.where('e.createdAt', '>=', createdAtFrom);
  }

  documentsQuery = documentsQuery
    .select([
      'e.id as id',
      'e.title as title',
      'e.status as status',
      'e.createdAt as createdAt',
      'e.completedAt as completedAt',
      't.name as teamName',
    ])
    .orderBy('e.createdAt', 'desc')
    .limit(perPage)
    .offset(offset);

  let countQuery = kyselyPrisma.$kysely
    .selectFrom('Envelope as e')
    .innerJoin('Team as t', 'e.teamId', 't.id')
    .where('t.organisationId', '=', organisationId)
    .where('e.deletedAt', 'is', null)
    .where(() => sql`e.type = ${EnvelopeType.DOCUMENT}::"EnvelopeType"`);

  if (createdAtFrom) {
    countQuery = countQuery.where('e.createdAt', '>=', createdAtFrom);
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
  const teamCountQuery = kyselyPrisma.$kysely
    .selectFrom('Team')
    .where('organisationId', '=', organisationId)
    .select(sql<number>`count(id)`.as('count'))
    .executeTakeFirst();

  const memberCountQuery = kyselyPrisma.$kysely
    .selectFrom('OrganisationMember')
    .where('organisationId', '=', organisationId)
    .select(sql<number>`count(id)`.as('count'))
    .executeTakeFirst();

  const envelopeStatsQuery = kyselyPrisma.$kysely
    .selectFrom('Envelope as e')
    .innerJoin('Team as t', 't.id', 'e.teamId')
    .where('t.organisationId', '=', organisationId)
    .where('e.deletedAt', 'is', null)
    .where('e.type', '=', sql.lit(EnvelopeType.DOCUMENT))
    .select([
      sql<number>`count(e.id)`.as('totalDocuments'),
      sql<number>`count(case when e.status in ('DRAFT', 'PENDING') then 1 end)`.as(
        'activeDocuments',
      ),
      sql<number>`count(case when e.status = 'COMPLETED' then 1 end)`.as('completedDocuments'),
      sql<number>`count(case when e.status = 'COMPLETED' then 1 end)`.as('volumeAllTime'),
      (createdAtFrom
        ? sql<number>`count(case when e.status = 'COMPLETED' and e."createdAt" >= ${createdAtFrom} then 1 end)`
        : sql<number>`count(case when e.status = 'COMPLETED' then 1 end)`
      ).as('volumeThisPeriod'),
    ])
    .executeTakeFirst();

  const [teamCount, memberCount, envelopeStats] = await Promise.all([
    teamCountQuery,
    memberCountQuery,
    envelopeStatsQuery,
  ]);

  return {
    totalTeams: Number(teamCount?.count || 0),
    totalMembers: Number(memberCount?.count || 0),
    totalDocuments: Number(envelopeStats?.totalDocuments || 0),
    activeDocuments: Number(envelopeStats?.activeDocuments || 0),
    completedDocuments: Number(envelopeStats?.completedDocuments || 0),
    volumeThisPeriod: Number(envelopeStats?.volumeThisPeriod || 0),
    volumeAllTime: Number(envelopeStats?.volumeAllTime || 0),
  };
}
