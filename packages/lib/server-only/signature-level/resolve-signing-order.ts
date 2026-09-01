import { DocumentSigningOrder } from '@prisma/client';

import { isTspEnvelope } from '../../types/signature-level';
import { assertCompatibleSigningOrder } from './assert-compatible-signing-order';

type ResolveSigningOrderOptions = {
  signatureLevel: string;
  requested?: DocumentSigningOrder | null;
};

/**
 * Resolve the persisted `signingOrder` for a new envelope's meta.
 *
 * - Explicit `requested` value: validated via
 *   {@link assertCompatibleSigningOrder} (throws on TSP + `PARALLEL`) and
 *   returned as-is.
 * - Omitted `requested`: returns the level-appropriate default —
 *   `SEQUENTIAL` for AES/QES (the TSP `/ByteRange` invariant requires it),
 *   `PARALLEL` for SES (preserves existing SES default behaviour).
 *
 * Use at every create-time call site instead of the bare `|| PARALLEL`
 * fallback. Mirrors {@link resolveSignatureLevel} in shape — the two pair
 * up to keep create-time defaulting + TSP-mode coercion uniform.
 */
export const resolveSigningOrder = ({
  signatureLevel,
  requested,
}: ResolveSigningOrderOptions): DocumentSigningOrder => {
  if (requested) {
    assertCompatibleSigningOrder({ signatureLevel, signingOrder: requested });

    return requested;
  }

  return isTspEnvelope({ signatureLevel }) ? DocumentSigningOrder.SEQUENTIAL : DocumentSigningOrder.PARALLEL;
};
