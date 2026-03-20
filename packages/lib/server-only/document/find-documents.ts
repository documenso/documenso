import type { DocumentSource, Envelope, Team, TeamEmail } from '@prisma/client';
import { DocumentVisibility } from '@prisma/client';
import { DocumentStatus } from '@prisma/client';
import { EnvelopeType, RecipientRole, SigningStatus, TeamMemberRole } from '@prisma/client';
import type { Expression, ExpressionBuilder, SelectQueryBuilder, SqlBool } from 'kysely';
import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

import { kyselyPrisma, prisma, sql } from '@documenso/prisma';
import type { DB } from '@documenso/prisma/generated/types';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

import { type FindResultResponse } from '../../types/search-params';
import { maskRecipientTokensForDocument } from '../../utils/mask-recipient-tokens-for-document';
import { getTeamById } from '../team/get-team';

export type PeriodSelectorValue = '' | '7d' | '14d' | '30d';

export type FindDocumentsOptions = {
  userId: number;
  teamId?: number;
  templateId?: number;
  source?: DocumentSource;
  status?: ExtendedDocumentStatus;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Pick<Envelope, 'createdAt'>;
    direction: 'asc' | 'desc';
  };
  period?: PeriodSelectorValue;
  senderIds?: number[];
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
 * stop early once it has enough rows. The offset ensures the count always reaches past
 * the current page, and the window provides look-ahead for the pagination UI.
 */
const COUNT_WINDOW_SIZE = 100;

/**
 * Cap for the recipient search subquery. When searching by recipient email/name,
 * we pre-compute matching envelope IDs up to this limit. This prevents
 * pathological cases where a broad search (e.g. "gmail") matches millions of
 * recipients and causes a heap scan.
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

export const findDocuments = async ({
  userId,
  teamId,
  templateId,
  source,
  status = ExtendedDocumentStatus.ALL,
  page = 1,
  perPage = 10,
  orderBy,
  period,
  senderIds,
  query = '',
  folderId,
  useWindowedCount = true,
}: FindDocumentsOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });

  let team = null;

  if (teamId !== undefined) {
    team = await getTeamById({ userId, teamId });
  }

  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';
  const searchQuery = query.trim();

  const hasSearch = searchQuery.length > 0;
  const searchPattern = `%${searchQuery}%`;

  // ─── Base query with common filters ──────────────────────────────────
  //
  // Every code path starts from this base: Envelope rows filtered by type,
  // folder, period, sender, source, template, and search.

  const buildBaseQuery = () => {
    let qb = kyselyPrisma.$kysely
      .selectFrom('Envelope')
      .select(['Envelope.id', 'Envelope.createdAt']);

    // Type must be DOCUMENT (enum cast requires raw sql — this is the one escape hatch)
    qb = qb.where('Envelope.type', '=', sql.lit(EnvelopeType.DOCUMENT));

    // Folder filter
    qb =
      folderId !== undefined
        ? qb.where('Envelope.folderId', '=', folderId)
        : qb.where('Envelope.folderId', 'is', null);

    // Period filter
    if (period) {
      const daysAgo = parseInt(period.replace(/d$/, ''), 10);
      const startOfPeriod = DateTime.now().minus({ days: daysAgo }).startOf('day');

      qb = qb.where('Envelope.createdAt', '>=', startOfPeriod.toJSDate());
    }

    // Sender filter
    if (senderIds && senderIds.length > 0) {
      qb = qb.where('Envelope.userId', 'in', senderIds);
    }

    // Source filter (enum cast)
    if (source) {
      qb = qb.where('Envelope.source', '=', sql.lit(source));
    }

    // Template filter
    if (templateId) {
      qb = qb.where('Envelope.templateId', '=', templateId);
    }

    // Search filter: title, externalId, or recipient match via capped subquery
    if (hasSearch) {
      qb = qb.where(({ or, eb }) =>
        or([
          eb('Envelope.title', 'ilike', searchPattern),
          eb('Envelope.externalId', 'ilike', searchPattern),
          // Capped recipient search subquery (uses trigram indexes)
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

    return qb;
  };

  // ─── Personal path filters ───────────────────────────────────────────

  const applyPersonalFilters = (qb: EnvelopeQueryBuilder): EnvelopeQueryBuilder | null => {
    // Deleted filter: owned → deletedAt IS NULL, received → documentDeletedAt IS NULL
    const personalDeletedFilter = (eb: EnvelopeExpressionBuilder) =>
      eb.or([
        eb.and([eb('Envelope.userId', '=', user.id), eb('Envelope.deletedAt', 'is', null)]),
        recipientExists(eb, user.email, (reb) => reb('Recipient.documentDeletedAt', 'is', null)),
      ]);

    return match<ExtendedDocumentStatus, EnvelopeQueryBuilder | null>(status)
      .with(ExtendedDocumentStatus.ALL, () =>
        qb.where((eb) =>
          eb.and([
            personalDeletedFilter(eb),
            eb.or([
              eb('Envelope.userId', '=', user.id),
              eb.and([
                eb('Envelope.status', 'in', [
                  sql.lit(DocumentStatus.COMPLETED),
                  sql.lit(DocumentStatus.PENDING),
                ]),
                recipientExists(eb, user.email),
              ]),
            ]),
          ]),
        ),
      )
      .with(ExtendedDocumentStatus.INBOX, () =>
        qb.where('Envelope.status', '!=', sql.lit(ExtendedDocumentStatus.DRAFT)).where((eb) =>
          // Single EXISTS check: the recipient must be NOT_SIGNED, non-CC, and
          // not soft-deleted. This replaces the previous personalDeletedFilter +
          // separate recipientExists pair, eliminating a hashed SubPlan that
          // materialised all recipient rows for this email (~125k for heavy users).
          recipientExists(eb, user.email, (reb) =>
            reb.and([
              reb('Recipient.documentDeletedAt', 'is', null),
              reb('signingStatus', '=', sql.lit(SigningStatus.NOT_SIGNED)),
              reb('role', '!=', sql.lit(RecipientRole.CC)),
            ]),
          ),
        ),
      )
      .with(ExtendedDocumentStatus.DRAFT, () =>
        qb
          .where('Envelope.userId', '=', user.id)
          .where('Envelope.deletedAt', 'is', null)
          .where('Envelope.status', '=', sql.lit(DocumentStatus.DRAFT)),
      )
      .with(ExtendedDocumentStatus.PENDING, () =>
        qb
          .where('Envelope.status', '=', sql.lit(DocumentStatus.PENDING))
          .where((eb) =>
            eb.and([
              personalDeletedFilter(eb),
              eb.or([
                eb('Envelope.userId', '=', user.id),
                recipientExists(eb, user.email, (reb) =>
                  reb.and([
                    reb('Recipient.signingStatus', '=', sql.lit(SigningStatus.SIGNED)),
                    reb('Recipient.role', '!=', sql.lit(RecipientRole.CC)),
                  ]),
                ),
              ]),
            ]),
          ),
      )
      .with(ExtendedDocumentStatus.COMPLETED, () =>
        qb
          .where('Envelope.status', '=', sql.lit(ExtendedDocumentStatus.COMPLETED))
          .where((eb) =>
            eb.and([
              personalDeletedFilter(eb),
              eb.or([eb('Envelope.userId', '=', user.id), recipientExists(eb, user.email)]),
            ]),
          ),
      )
      .with(ExtendedDocumentStatus.REJECTED, () =>
        qb
          .where('Envelope.status', '=', sql.lit(ExtendedDocumentStatus.REJECTED))
          .where((eb) =>
            eb.and([
              personalDeletedFilter(eb),
              eb.or([
                eb('Envelope.userId', '=', user.id),
                recipientExists(eb, user.email, (reb) =>
                  reb('Recipient.signingStatus', '=', sql.lit(SigningStatus.REJECTED)),
                ),
              ]),
            ]),
          ),
      )
      .exhaustive();
  };

  // ─── Team path filters ───────────────────────────────────────────────

  const applyTeamFilters = (
    qb: EnvelopeQueryBuilder,
    teamData: Team & { teamEmail: TeamEmail | null; currentTeamRole: TeamMemberRole },
  ): EnvelopeQueryBuilder | null => {
    const teamEmail = teamData.teamEmail?.email ?? null;

    const allowedVisibilities = match(teamData.currentTeamRole)
      .with(TeamMemberRole.ADMIN, () => [
        DocumentVisibility.EVERYONE,
        DocumentVisibility.MANAGER_AND_ABOVE,
        DocumentVisibility.ADMIN,
      ])
      .with(TeamMemberRole.MANAGER, () => [
        DocumentVisibility.EVERYONE,
        DocumentVisibility.MANAGER_AND_ABOVE,
      ])
      .otherwise(() => [DocumentVisibility.EVERYONE]);

    // Visibility: meets role threshold OR directly involved
    const visibilityFilter = (eb: EnvelopeExpressionBuilder) =>
      eb.or([
        eb(
          'Envelope.visibility',
          'in',
          allowedVisibilities.map((v) => sql.lit(v)),
        ),
        eb('Envelope.userId', '=', user.id),
        recipientExists(eb, user.email),
      ]);

    // Deleted filter for team path
    const teamDeletedFilter = (eb: EnvelopeExpressionBuilder) => {
      const branches = [
        eb.and([eb('Envelope.teamId', '=', teamData.id), eb('Envelope.deletedAt', 'is', null)]),
      ];

      if (teamEmail) {
        branches.push(eb.and([senderEmailIs(eb, teamEmail), eb('Envelope.deletedAt', 'is', null)]));
        branches.push(
          recipientExists(eb, teamEmail, (reb) => reb('Recipient.documentDeletedAt', 'is', null)),
        );
      }

      return eb.or(branches);
    };

    return match<ExtendedDocumentStatus, EnvelopeQueryBuilder | null>(status)
      .with(ExtendedDocumentStatus.ALL, () =>
        qb.where((eb) => {
          const accessBranches = [eb('Envelope.teamId', '=', teamData.id)];

          if (teamEmail) {
            accessBranches.push(senderEmailIs(eb, teamEmail));
            accessBranches.push(
              eb.and([
                eb('status', '!=', sql.lit(ExtendedDocumentStatus.DRAFT)),
                recipientExists(eb, teamEmail),
              ]),
            );
          }

          return eb.and([teamDeletedFilter(eb), visibilityFilter(eb), eb.or(accessBranches)]);
        }),
      )
      .with(ExtendedDocumentStatus.INBOX, () => {
        if (!teamEmail) {
          return null;
        }

        return qb
          .where('Envelope.status', '!=', sql.lit(ExtendedDocumentStatus.DRAFT))
          .where((eb) =>
            eb.and([
              visibilityFilter(eb),
              // Single EXISTS check: the team-email recipient must be NOT_SIGNED,
              // non-CC, and not soft-deleted. Replaces teamDeletedFilter + separate
              // recipientExists, eliminating a hashed SubPlan (~79k rows).
              recipientExists(eb, teamEmail, (reb) =>
                reb.and([
                  reb('Recipient.documentDeletedAt', 'is', null),
                  reb('Recipient.signingStatus', '=', sql.lit(SigningStatus.NOT_SIGNED)),
                  reb('Recipient.role', '!=', sql.lit(RecipientRole.CC)),
                ]),
              ),
            ]),
          );
      })
      .with(ExtendedDocumentStatus.DRAFT, () =>
        qb.where('Envelope.status', '=', sql.lit(ExtendedDocumentStatus.DRAFT)).where((eb) => {
          const accessBranches = [eb('Envelope.teamId', '=', teamData.id)];

          if (teamEmail) {
            accessBranches.push(senderEmailIs(eb, teamEmail));
          }

          return eb.and([teamDeletedFilter(eb), visibilityFilter(eb), eb.or(accessBranches)]);
        }),
      )
      .with(ExtendedDocumentStatus.PENDING, () =>
        qb.where('Envelope.status', '=', sql.lit(ExtendedDocumentStatus.PENDING)).where((eb) => {
          const accessBranches = [eb('Envelope.teamId', '=', teamData.id)];

          if (teamEmail) {
            accessBranches.push(senderEmailIs(eb, teamEmail));
            accessBranches.push(
              recipientExists(eb, teamEmail, (reb) =>
                reb.and([
                  reb('Recipient.signingStatus', '=', sql.lit(SigningStatus.SIGNED)),
                  reb('Recipient.role', '!=', sql.lit(RecipientRole.CC)),
                ]),
              ),
            );
          }

          return eb.and([teamDeletedFilter(eb), visibilityFilter(eb), eb.or(accessBranches)]);
        }),
      )
      .with(ExtendedDocumentStatus.COMPLETED, () =>
        qb.where('Envelope.status', '=', sql.lit(ExtendedDocumentStatus.COMPLETED)).where((eb) => {
          const accessBranches = [eb('Envelope.teamId', '=', teamData.id)];

          if (teamEmail) {
            accessBranches.push(senderEmailIs(eb, teamEmail));
            accessBranches.push(recipientExists(eb, teamEmail));
          }

          return eb.and([teamDeletedFilter(eb), visibilityFilter(eb), eb.or(accessBranches)]);
        }),
      )
      .with(ExtendedDocumentStatus.REJECTED, () =>
        qb.where('Envelope.status', '=', sql.lit(ExtendedDocumentStatus.REJECTED)).where((eb) => {
          const accessBranches = [eb('Envelope.teamId', '=', teamData.id)];

          if (teamEmail) {
            accessBranches.push(senderEmailIs(eb, teamEmail));
            accessBranches.push(
              recipientExists(eb, teamEmail, (reb) =>
                reb('Recipient.signingStatus', '=', sql.lit(SigningStatus.REJECTED)),
              ),
            );
          }

          return eb.and([teamDeletedFilter(eb), visibilityFilter(eb), eb.or(accessBranches)]);
        }),
      )
      .exhaustive();
  };

  // ─── Assemble and execute ────────────────────────────────────────────

  const baseQuery = buildBaseQuery();

  const filteredQuery = team ? applyTeamFilters(baseQuery, team) : applyPersonalFilters(baseQuery);

  if (filteredQuery === null) {
    return {
      data: [],
      count: 0,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: 0,
    };
  }

  const offset = Math.max(page - 1, 0) * perPage;

  // Data query: paginated, executed directly via Kysely query builder
  const dataQuery = filteredQuery
    .orderBy(`Envelope.${orderByColumn}`, orderByDirection)
    .limit(perPage)
    .offset(offset);

  // Count query: either windowed (fast, capped) or full (exact, for API consumers).
  const baseCountQuery = filteredQuery.clearSelect().select('Envelope.id');

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
    };
  }

  const data = await prisma.envelope.findMany({
    where: { id: { in: ids } },
    orderBy: { [orderByColumn]: orderByDirection },
    include: {
      user: { select: { id: true, name: true, email: true } },
      recipients: true,
      team: { select: { id: true, url: true } },
      envelopeItems: {
        select: { id: true, envelopeId: true, title: true, order: true },
      },
    },
  });

  // Preserve ordering from the Kysely query
  const idOrder = new Map(ids.map((id, index) => [id, index]));
  data.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

  const maskedData = data.map((document) => maskRecipientTokensForDocument({ document, user }));

  return {
    data: maskedData,
    count: totalCount,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(totalCount / perPage),
  } satisfies FindResultResponse<typeof data>;
};
