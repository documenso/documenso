import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { type TCscSessionItems, ZCscSessionItemsSchema } from '@documenso/lib/types/csc-session';
import { prisma } from '@documenso/prisma';
import { Prisma } from '@prisma/client';

/**
 * DB helpers for `CscSession` — the per-recipient transient row that bridges
 * prep, the credential-scope OAuth round-trip, and the sync sign mutation.
 *
 * Four operations cover the spec's lifecycle:
 *
 * - {@link upsertCscSession} — prep time; clears any prior SAD by writing
 *   `encryptedSad = null` so a re-clicked Sign starts fresh.
 * - {@link updateCscSessionWithSad} — credential-scope callback; sets the
 *   SAD + its TSP-asserted expiry.
 * - {@link loadCscSession} — authorize route, signing-page loader, sync
 *   mutation. Returns null on missing (cookie referenced a deleted session).
 * - {@link consumeCscSession} — sync mutation success path; single-use delete
 *   returning the consumed row so the caller can use its data post-deletion.
 *
 * `itemsJson` is parsed through `ZCscSessionItemsSchema` on every read so the
 * caller works with typed {@link TCscSessionItems}.
 */

export type CscSessionRow = {
  id: string;
  recipientId: number;
  envelopeId: string;
  signingTime: Date;
  items: TCscSessionItems;
  encryptedSad: Uint8Array | null;
  sadExpiresAt: Date | null;
  createdAt: Date;
};

type UpsertCscSessionInput = {
  recipientId: number;
  envelopeId: string;
  signingTime: Date;
  items: TCscSessionItems;
};

/**
 * Create or refresh the per-recipient session row at prep time. The recipient
 * has at most one in-flight session (`@@unique([recipientId])`); re-clicking
 * Sign overwrites prior `itemsJson` + clears `encryptedSad` / `sadExpiresAt`
 * so the next credential-scope callback starts from a clean SAD slot.
 */
export const upsertCscSession = async (input: UpsertCscSessionInput): Promise<CscSessionRow> => {
  const { recipientId, envelopeId, signingTime, items } = input;

  const row = await prisma.cscSession.upsert({
    where: { recipientId },
    create: {
      recipientId,
      envelopeId,
      signingTime,
      itemsJson: items,
      encryptedSad: null,
      sadExpiresAt: null,
    },
    update: {
      envelopeId,
      signingTime,
      itemsJson: items,
      encryptedSad: null,
      sadExpiresAt: null,
    },
  });

  return toCscSessionRow(row);
};

type UpdateCscSessionWithSadInput = {
  sessionId: string;
  encryptedSad: Uint8Array;
  sadExpiresAt: Date;
};

/**
 * Stamp the credential-scope SAD onto an existing session at the OAuth
 * callback. Throws when the session id was already consumed or never existed
 * — that's a flow-state bug the caller must surface, not silently skip.
 */
export const updateCscSessionWithSad = async (input: UpdateCscSessionWithSadInput): Promise<CscSessionRow> => {
  const { sessionId, encryptedSad, sadExpiresAt } = input;

  try {
    const row = await prisma.cscSession.update({
      where: {
        id: sessionId,
      },
      data: {
        encryptedSad: Buffer.from(encryptedSad),
        sadExpiresAt,
      },
    });

    return toCscSessionRow(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `CSC session "${sessionId}" not found at SAD attach time.`,
      });
    }

    throw err;
  }
};

/**
 * Fetch a session by id. Returns `null` when the row is absent — callers MUST
 * handle the missing case (cookie outliving the row is a normal terminal
 * outcome, not an error).
 */
export const loadCscSession = async (sessionId: string): Promise<CscSessionRow | null> => {
  const row = await prisma.cscSession.findUnique({
    where: { id: sessionId },
  });

  return row ? toCscSessionRow(row) : null;
};

/**
 * Atomically delete the session row and return its parsed contents. Used by
 * the sync mutation's success path so the caller still has the session data
 * for post-sign side effects (audit log, webhook payloads).
 *
 * Throws `NOT_FOUND` when the row is already gone — semantically distinct
 * from {@link loadCscSession}'s nullable return because consume is the
 * success-path single-use closer; a missing row at that point means another
 * branch raced to consume and the caller should not double-count.
 */
export const consumeCscSession = async (sessionId: string, tx?: Prisma.TransactionClient): Promise<CscSessionRow> => {
  const client = tx ?? prisma;

  try {
    const row = await client.cscSession.delete({
      where: { id: sessionId },
    });

    return toCscSessionRow(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `CSC session "${sessionId}" already consumed or never existed.`,
      });
    }

    throw err;
  }
};

/**
 * Project a raw Prisma `CscSession` into the helper's parsed shape. Throws
 * on `itemsJson` parse failure — that's a data-integrity issue, not a
 * recoverable runtime case.
 */
const toCscSessionRow = (row: {
  id: string;
  recipientId: number;
  envelopeId: string;
  signingTime: Date;
  itemsJson: Prisma.JsonValue;
  encryptedSad: Uint8Array | null;
  sadExpiresAt: Date | null;
  createdAt: Date;
}): CscSessionRow => {
  const items = ZCscSessionItemsSchema.parse(row.itemsJson);

  return {
    id: row.id,
    recipientId: row.recipientId,
    envelopeId: row.envelopeId,
    signingTime: row.signingTime,
    items,
    encryptedSad: row.encryptedSad,
    sadExpiresAt: row.sadExpiresAt,
    createdAt: row.createdAt,
  };
};
