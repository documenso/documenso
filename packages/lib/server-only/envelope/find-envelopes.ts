import type { DocumentSource, DocumentStatus, Envelope, EnvelopeType } from '@prisma/client';
import type { Expression, ExpressionBuilder, SelectQueryBuilder, SqlBool } from 'kysely';

import { kyselyPrisma, prisma, sql } from '@documenso/prisma';
import type { DB } from '@documenso/prisma/generated/types';

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
  /**
   * When true (default), use a windowed count that caps early for faster pagination.
   * When false, use a full COUNT(*) for exact totals — preferred for external API consumers.
   */
  useWindowedCount?: boolean;
};

/**
 * The number of pages ahead of the current page we'll scan for pagination.
 *
 * Instead of COUNT(*) over the entire result set (which must scan all qualifying rows),
 * we fetch at most `offset + COUNT_WINDOW_SIZE * perPage + 1` IDs. This lets Postgres
 * stop early once it has enough rows.
 */
const COUNT_WINDOW_SIZE = 100;

/**
 * Cap for the recipient search subquery. When searching by recipient email/name,
 * we pre-compute matching envelope IDs up to this limit to prevent pathological
 * heap scans on broad searches.
 */
const RECIPIENT_SEARCH_CAP = 1000;

// Kysely query builder type for Envelope queries.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EnvelopeQueryBuilder = SelectQueryBuilder<DB, 'Envelope', any>;

// Expression builder type scoped to Envelope table context.
type EnvelopeExpressionBuilder = ExpressionBuilder<DB, 'Envelope'>;
type RecipientExpressionBuilder = ExpressionBuilder<DB, 'Recipient'>;

/**
 * Reusable EXISTS subquery: checks that a Recipient row exists for the given
 * envelope with the given email, plus optional extra conditions.
 */
const recipientExists = (
  eb: EnvelopeExpressionBuilder,
  email: string,
  extra?: (qb: RecipientExpressionBuilder) => Expression<SqlBool>,
) => {
  let sub = eb
    .selectFrom('Recipient')
    .whereRef('Recipient.envelopeId', '=', 'Envelope.id')
    .where('Recipient.email', '=', email);

  if (extra) {
    sub = sub.where(extra);
  }

  return eb.exists(sub.select(sql.lit(1).as('one')));
};

/**
 * Reusable EXISTS subquery: checks that the envelope's sender (User) has the given email.
 */
const senderEmailIs = (eb: EnvelopeExpressionBuilder, email: string) =>
  eb.exists(
    eb
      .selectFrom('User')
      .whereRef('User.id', '=', 'Envelope.userId')
      .where('User.email', '=', email)
      .select(sql.lit(1).as('one')),
  );

/**
 * Find envelopes visible to the requesting user within a team.
 *
 * Unlike `findDocuments` (used by the UI), being a recipient does NOT override
 * document visibility. A user will only see an envelope if its visibility level
 * is within their role's threshold, or they are the document owner.
 */
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
  useWindowedCount = true,
}: FindEnvelopesOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });

  const team = await getTeamById({ userId, teamId });

  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';
  const searchQuery = query.trim();
  const hasSearch = searchQuery.length > 0;
  const searchPattern = `%${searchQuery}%`;

  const teamEmail = team.teamEmail?.email ?? null;
  const allowedVisibilities = TEAM_DOCUMENT_VISIBILITY_MAP[team.currentTeamRole];

  // ─── Build Kysely query ──────────────────────────────────────────────

  let qb: EnvelopeQueryBuilder = kyselyPrisma.$kysely
    .selectFrom('Envelope')
    .select(['Envelope.id', 'Envelope.createdAt']);

  // Folder filter
  qb =
    folderId !== undefined
      ? qb.where('Envelope.folderId', '=', folderId)
      : qb.where('Envelope.folderId', 'is', null);

  // Exclude soft-deleted envelopes
  qb = qb.where('Envelope.deletedAt', 'is', null);

  // Type filter (enum cast)
  if (type) {
    qb = qb.where('Envelope.type', '=', sql.lit(type));
  }

  // Template filter
  if (templateId) {
    qb = qb.where('Envelope.templateId', '=', templateId);
  }

  // Source filter (enum cast)
  if (source) {
    qb = qb.where('Envelope.source', '=', sql.lit(source));
  }

  // Status filter (enum cast)
  if (status) {
    qb = qb.where('Envelope.status', '=', sql.lit(status));
  }

  // Search filter: title, externalId, or recipient match via capped subquery
  if (hasSearch) {
    qb = qb.where(({ or, eb }) =>
      or([
        eb('Envelope.title', 'ilike', searchPattern),
        eb('Envelope.externalId', 'ilike', searchPattern),
        eb(
          'Envelope.id',
          'in',
          eb
            .selectFrom('Recipient')
            .select('Recipient.envelopeId')
            .where(({ or: innerOr, eb: innerEb }) =>
              innerOr([
                innerEb('Recipient.email', 'ilike', searchPattern),
                innerEb('Recipient.name', 'ilike', searchPattern),
              ]),
            )
            .distinct()
            .limit(RECIPIENT_SEARCH_CAP),
        ),
      ]),
    );
  }

  // ─── Access control ──────────────────────────────────────────────────
  //
  // An envelope is visible if ANY of:
  //   1. It belongs to this team AND (meets the visibility threshold OR the requesting user is the owner)
  //   2. (If team email) The sender's email matches the team email
  //   3. (If team email) A recipient's email matches the team email

  const visibilityFilter = (eb: EnvelopeExpressionBuilder) =>
    eb.or([
      eb(
        'Envelope.visibility',
        'in',
        allowedVisibilities.map((v) => sql.lit(v)),
      ),
      // Owner always sees their own docs within this team
      eb('Envelope.userId', '=', user.id),
    ]);

  qb = qb.where((eb) => {
    const accessBranches: Expression<SqlBool>[] = [
      // Team docs that pass visibility (or are owned by the user)
      eb.and([eb('Envelope.teamId', '=', team.id), visibilityFilter(eb)]),
    ];

    if (teamEmail) {
      // Docs sent by the team email user
      accessBranches.push(senderEmailIs(eb, teamEmail));
      // Docs received by the team email
      accessBranches.push(recipientExists(eb, teamEmail));
    }

    return eb.or(accessBranches);
  });

  // ─── Execute: paginated data + count ──────────────────────────────────

  const offset = Math.max(page - 1, 0) * perPage;

  const dataQuery = qb
    .orderBy(`Envelope.${orderByColumn}`, orderByDirection)
    .limit(perPage)
    .offset(offset);

  // Count query: either windowed (fast, capped) or full (exact, for API consumers).
  const baseCountQuery = qb.clearSelect().select('Envelope.id');

  const countQuery = useWindowedCount
    ? kyselyPrisma.$kysely
        .selectFrom(baseCountQuery.limit(offset + COUNT_WINDOW_SIZE * perPage + 1).as('windowed'))
        .select(({ fn }) => fn.count<number>('id').as('total'))
    : kyselyPrisma.$kysely
        .selectFrom(baseCountQuery.as('filtered'))
        .select(({ fn }) => fn.count<number>('id').as('total'));

  const [dataResult, countResult] = await Promise.all([
    dataQuery.execute(),
    countQuery.executeTakeFirstOrThrow(),
  ]);

  const ids = dataResult.map((row) => row.id);

  const totalCount = useWindowedCount
    ? Math.min(Number(countResult.total ?? 0), offset + COUNT_WINDOW_SIZE * perPage)
    : Number(countResult.total ?? 0);

  // ─── Hydrate with Prisma ─────────────────────────────────────────────

  if (ids.length === 0) {
    return {
      data: [],
      count: totalCount,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: Math.ceil(totalCount / perPage),
    } satisfies FindResultResponse<never[]>;
  }

  const data = await prisma.envelope.findMany({
    where: { id: { in: ids } },
    orderBy: { [orderByColumn]: orderByDirection },
    include: {
      user: { select: { id: true, name: true, email: true } },
      recipients: { orderBy: { id: 'asc' } },
      team: { select: { id: true, url: true } },
    },
  });

  // Preserve ordering from the Kysely query
  const idOrder = new Map(ids.map((id, index) => [id, index]));
  data.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

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
    count: totalCount,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(totalCount / perPage),
  } satisfies FindResultResponse<typeof mappedData>;
};
