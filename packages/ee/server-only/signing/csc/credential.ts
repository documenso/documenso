import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { Prisma } from '@prisma/client';

/**
 * DB helpers for `CscCredential` — the per-recipient row that holds the
 * TSP-validated certificate chain, the resolved algorithm policy, and the
 * encrypted service-scope access token.
 *
 * Lifecycle mirrors {@link sign-session.ts} but with a longer-lived row:
 *
 * - {@link upsertCscCredential} — service-scope OAuth callback writes the
 *   full credential after `credentials/info` + algorithm validation succeed.
 *   Re-runs replace prior bytes (cert / token rotates as the TSP refreshes).
 * - {@link loadCscCredential} — sign-time fetches by `recipientId` to recover
 *   the persisted algorithm + encrypted service token; returns `null` when
 *   the recipient never completed service-scope OAuth.
 *
 * Encryption is the caller's job — both byte columns hold raw ciphertext
 * produced by {@link encryptCscToken} so the helpers stay cipher-agnostic.
 * Cascade cleanup on `Recipient` delete removes the row transitively.
 */

export type CscCredentialRow = {
  id: string;
  recipientId: number;
  providerId: string;
  credentialId: string;
  certCache: Uint8Array | null;
  signatureAlgorithm: string;
  keyType: string;
  digestAlgorithm: string;
  keyLenBits: number | null;
  signAlgoParams: string | null;
  serviceTokenCiphertext: Uint8Array | null;
  serviceTokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type UpsertCscCredentialInput = {
  recipientId: number;
  providerId: string;
  credentialId: string;
  /** Length-prefixed X.509 chain — produced from `cscCredentialsInfo.cert.certificates`. */
  certCache: Uint8Array;
  /** OID persisted from {@link CscAlgorithmPolicy.signAlgoOid}. */
  signatureAlgorithm: string;
  /** `'RSA'` or `'ECDSA'` from the resolved policy. */
  keyType: string;
  /** `'SHA-256'` / `'SHA-384'` / `'SHA-512'` from the resolved policy. */
  digestAlgorithm: string;
  keyLenBits: number;
  /** RSASSA-PSS only; omit otherwise. */
  signAlgoParams?: string;
  /** Output of {@link encryptCscToken}. */
  serviceTokenCiphertext: Uint8Array;
  /** Mirrors the TSP's `expires_in` projected onto wall-clock. */
  serviceTokenExpiresAt: Date;
};

/**
 * Create or refresh the per-recipient credential row at service-scope OAuth
 * callback success. Replaces every prior byte payload — a re-auth always
 * supersedes the prior cert + token (TSPs may have rotated either).
 */
export const upsertCscCredential = async (input: UpsertCscCredentialInput): Promise<CscCredentialRow> => {
  const {
    recipientId,
    providerId,
    credentialId,
    certCache,
    signatureAlgorithm,
    keyType,
    digestAlgorithm,
    keyLenBits,
    signAlgoParams,
    serviceTokenCiphertext,
    serviceTokenExpiresAt,
  } = input;

  const row = await prisma.cscCredential.upsert({
    where: { recipientId },
    create: {
      recipientId,
      providerId,
      credentialId,
      certCache,
      signatureAlgorithm,
      keyType,
      digestAlgorithm,
      keyLenBits,
      signAlgoParams: signAlgoParams ?? null,
      serviceTokenCiphertext,
      serviceTokenExpiresAt,
    },
    update: {
      providerId,
      credentialId,
      certCache,
      signatureAlgorithm,
      keyType,
      digestAlgorithm,
      keyLenBits,
      signAlgoParams: signAlgoParams ?? null,
      serviceTokenCiphertext,
      serviceTokenExpiresAt,
    },
  });

  return toCscCredentialRow(row);
};

/**
 * Fetch the credential row for a recipient. Returns `null` when absent — the
 * recipient hasn't completed service-scope OAuth yet (loader path) or the
 * recipient cascade fired (cleanup path). Both are normal terminal outcomes.
 */
export const loadCscCredential = async (recipientId: number): Promise<CscCredentialRow | null> => {
  const row = await prisma.cscCredential.findUnique({
    where: { recipientId },
  });

  return row ? toCscCredentialRow(row) : null;
};

/**
 * Explicit delete by recipient id. Recipient-cascade handles routine cleanup;
 * this helper is for operator-triggered re-auth flows (force the next visit
 * to re-do service-scope OAuth even within the trust window).
 *
 * Throws `NOT_FOUND` when the row is already gone — semantically distinct
 * from {@link loadCscCredential}'s nullable return because explicit delete
 * is a deliberate operation and silent no-op would mask flow-state bugs.
 */
export const deleteCscCredential = async (recipientId: number): Promise<CscCredentialRow> => {
  try {
    const row = await prisma.cscCredential.delete({
      where: { recipientId },
    });

    return toCscCredentialRow(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `CSC credential for recipient ${recipientId} not found.`,
      });
    }

    throw err;
  }
};

const toCscCredentialRow = (row: {
  id: string;
  recipientId: number;
  providerId: string;
  credentialId: string;
  certCache: Uint8Array | null;
  signatureAlgorithm: string;
  keyType: string;
  digestAlgorithm: string;
  keyLenBits: number | null;
  signAlgoParams: string | null;
  serviceTokenCiphertext: Uint8Array | null;
  serviceTokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CscCredentialRow => ({
  id: row.id,
  recipientId: row.recipientId,
  providerId: row.providerId,
  credentialId: row.credentialId,
  certCache: row.certCache,
  signatureAlgorithm: row.signatureAlgorithm,
  keyType: row.keyType,
  digestAlgorithm: row.digestAlgorithm,
  keyLenBits: row.keyLenBits,
  signAlgoParams: row.signAlgoParams,
  serviceTokenCiphertext: row.serviceTokenCiphertext,
  serviceTokenExpiresAt: row.serviceTokenExpiresAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
