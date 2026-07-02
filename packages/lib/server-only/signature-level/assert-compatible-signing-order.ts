import { DocumentSigningOrder } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { isTspEnvelope } from '../../types/signature-level';

type AssertCompatibleSigningOrderOptions = {
  signatureLevel: string;
  signingOrder: DocumentSigningOrder | null | undefined;
};

/**
 * Reject `signingOrder = PARALLEL` on AES/QES envelopes.
 *
 * Parallel signing produces conflicting incremental PDF updates over the
 * same base state, breaking the per-recipient `/ByteRange` invariant that
 * lets each TSP signature verify independently. Sequential is the only safe
 * order for TSP-signed envelopes.
 *
 * SES envelopes pass through unchanged — PARALLEL remains the SES default.
 * A `null` / `undefined` signingOrder also passes through (the create-envelope
 * caller decides the default).
 *
 * Schema-layer guard. {@link sendDocument} re-coerces at distribution time
 * as a defence-in-depth backstop.
 */
export const assertCompatibleSigningOrder = ({
  signatureLevel,
  signingOrder,
}: AssertCompatibleSigningOrderOptions): void => {
  if (!isTspEnvelope({ signatureLevel })) {
    return;
  }

  if (signingOrder !== DocumentSigningOrder.PARALLEL) {
    return;
  }

  throw new AppError(AppErrorCode.INVALID_BODY, {
    message: `Envelopes signed at '${signatureLevel}' require signingOrder=SEQUENTIAL — PARALLEL breaks the per-recipient /ByteRange invariant required for TSP signatures to verify independently.`,
  });
};
