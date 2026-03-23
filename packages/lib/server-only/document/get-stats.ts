import {
  DocumentStatus,
  EnvelopeType,
  RecipientRole,
  SigningStatus,
  TeamMemberRole,
} from '@prisma/client';
import type { Expression, ExpressionBuilder, SelectQueryBuilder, SqlBool } from 'kysely';
import { DateTime } from 'luxon';

import type { PeriodSelectorValue } from '@documenso/lib/server-only/document/find-documents';
import { kyselyPrisma, prisma, sql } from '@documenso/prisma';
import type { DB } from '@documenso/prisma/generated/types';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

import { STATS_COUNT_CAP } from '../../constants/document';
import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { getTeamById } from '../team/get-team';

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

export type GetStatsInput = {
  userId: number;
  teamId: number;
  period?: PeriodSelectorValue;
  search?: string;
  folderId?: string;
  senderIds?: number[];
};

/**
 * Builds a capped count from a query builder: wraps it as
 * `SELECT COUNT(*) FROM (SELECT id FROM ... LIMIT cap+1) sub`
 * and clamps the result to STATS_COUNT_CAP.
 */
const cappedCount = async (qb: EnvelopeQueryBuilder): Promise<number> => {
  const result = await kyselyPrisma.$kysely
    .selectFrom(
      qb
        .clearSelect()
        .select('Envelope.id')
        .limit(STATS_COUNT_CAP + 1)
        .as('capped'),
    )
    .select(({ fn }) => fn.count<number>('id').as('total'))
    .executeTakeFirstOrThrow();

  return Math.min(Number(result.total ?? 0), STATS_COUNT_CAP);
};

export const getStats = async ({
  userId,
  teamId,
  period,
  search = '',
  folderId,
  senderIds,
}: GetStatsInput) => {
  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId },
    select: { id: true, email: true },
  });

  const team = await getTeamById({ userId, teamId });

  const teamEmail = team.teamEmail?.email ?? null;
  const currentTeamRole = team.currentTeamRole ?? TeamMemberRole.MEMBER;
  const allowedVisibilities = TEAM_DOCUMENT_VISIBILITY_MAP[currentTeamRole];

  const searchQuery = search.trim();
  const hasSearch = searchQuery.length > 0;
  const searchPattern = `%${searchQuery}%`;

  // ─── Base query builder ──────────────────────────────────────────────

  const buildBaseQuery = (): EnvelopeQueryBuilder => {
    let qb: EnvelopeQueryBuilder = kyselyPrisma.$kysely
      .selectFrom('Envelope')
      .select('Envelope.id');

    // Type = DOCUMENT
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

    // Search filter
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
              .limit(1000),
          ),
        ]),
      );
    }

    return qb;
  };

  // ─── Shared filter helpers ───────────────────────────────────────────

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

  const teamDeletedFilter = (eb: EnvelopeExpressionBuilder) => {
    const branches = [
      eb.and([eb('Envelope.teamId', '=', team.id), eb('Envelope.deletedAt', 'is', null)]),
    ];

    if (teamEmail) {
      branches.push(eb.and([senderEmailIs(eb, teamEmail), eb('Envelope.deletedAt', 'is', null)]));
      branches.push(
        recipientExists(eb, teamEmail, (reb) => reb('Recipient.documentDeletedAt', 'is', null)),
      );
    }

    return eb.or(branches);
  };

  // ─── Per-status query builders ───────────────────────────────────────

  // DRAFT: team-owned drafts visible to the user
  const draftQuery = buildBaseQuery()
    .where('Envelope.status', '=', sql.lit(DocumentStatus.DRAFT))
    .where((eb) => {
      const accessBranches = [eb('Envelope.teamId', '=', team.id)];

      if (teamEmail) {
        accessBranches.push(senderEmailIs(eb, teamEmail));
      }

      return eb.and([teamDeletedFilter(eb), visibilityFilter(eb), eb.or(accessBranches)]);
    });

  // PENDING: team-owned pending + team-email signed-pending docs
  const pendingQuery = buildBaseQuery()
    .where('Envelope.status', '=', sql.lit(DocumentStatus.PENDING))
    .where((eb) => {
      const accessBranches = [eb('Envelope.teamId', '=', team.id)];

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
    });

  // COMPLETED: team-owned completed + team-email received completed
  const completedQuery = buildBaseQuery()
    .where('Envelope.status', '=', sql.lit(DocumentStatus.COMPLETED))
    .where((eb) => {
      const accessBranches = [eb('Envelope.teamId', '=', team.id)];

      if (teamEmail) {
        accessBranches.push(senderEmailIs(eb, teamEmail));
        accessBranches.push(recipientExists(eb, teamEmail));
      }

      return eb.and([teamDeletedFilter(eb), visibilityFilter(eb), eb.or(accessBranches)]);
    });

  // REJECTED: team-owned rejected + team-email rejected docs
  const rejectedQuery = buildBaseQuery()
    .where('Envelope.status', '=', sql.lit(DocumentStatus.REJECTED))
    .where((eb) => {
      const accessBranches = [eb('Envelope.teamId', '=', team.id)];

      if (teamEmail) {
        accessBranches.push(senderEmailIs(eb, teamEmail));
        accessBranches.push(
          recipientExists(eb, teamEmail, (reb) =>
            reb('Recipient.signingStatus', '=', sql.lit(SigningStatus.REJECTED)),
          ),
        );
      }

      return eb.and([teamDeletedFilter(eb), visibilityFilter(eb), eb.or(accessBranches)]);
    });

  // INBOX: non-draft docs where team email is a NOT_SIGNED, non-CC recipient
  // Returns 0 if the team has no team email.
  const inboxQuery = teamEmail
    ? buildBaseQuery()
        .where('Envelope.status', '!=', sql.lit(DocumentStatus.DRAFT))
        .where((eb) =>
          eb.and([
            visibilityFilter(eb),
            recipientExists(eb, teamEmail, (reb) =>
              reb.and([
                reb('Recipient.documentDeletedAt', 'is', null),
                reb('Recipient.signingStatus', '=', sql.lit(SigningStatus.NOT_SIGNED)),
                reb('Recipient.role', '!=', sql.lit(RecipientRole.CC)),
              ]),
            ),
          ]),
        )
    : null;

  // ─── Execute all counts in parallel ──────────────────────────────────

  const [draft, pending, completed, rejected, inbox] = await Promise.all([
    cappedCount(draftQuery),
    cappedCount(pendingQuery),
    cappedCount(completedQuery),
    cappedCount(rejectedQuery),
    inboxQuery ? cappedCount(inboxQuery) : Promise.resolve(0),
  ]);

  const all = Math.min(draft + pending + completed + rejected + inbox, STATS_COUNT_CAP);

  const stats: Record<ExtendedDocumentStatus, number> = {
    [ExtendedDocumentStatus.DRAFT]: draft,
    [ExtendedDocumentStatus.PENDING]: pending,
    [ExtendedDocumentStatus.COMPLETED]: completed,
    [ExtendedDocumentStatus.REJECTED]: rejected,
    [ExtendedDocumentStatus.INBOX]: inbox,
    [ExtendedDocumentStatus.ALL]: all,
  };

  return stats;
};
