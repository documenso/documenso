import type { Recipient } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { isTspEnvelope } from '../../types/signature-level';
import { effectiveSigningOrder } from '../../utils/recipient-groups';
import { isCcRecipient } from '../../utils/recipients';

type AssertCompatibleRecipientGroupingOptions = {
  signatureLevel: string;
  recipients: Array<Pick<Recipient, 'role'> & { signingOrder?: number | null }>;
};

/**
 * Reject recipient signing groups on AES/QES envelopes.
 *
 * A "group" is two or more signing recipients sharing a signing step, which
 * they may then complete in any order — including at the same time. That is
 * parallel signing scoped to one step
 *
 * Recipients sharing a step are detected by {@link effectiveSigningOrder}, so an
 * absent signing order counts too — every unordered recipient lands in the
 * same tail step and would sign in parallel.
 *
 * CC recipients are ignored: they never sign, and their signing order carries
 * no meaning anywhere else.
 *
 * SES envelopes pass through unchanged — signing groups are an SES feature.
 */
export const assertCompatibleRecipientGrouping = ({
  signatureLevel,
  recipients,
}: AssertCompatibleRecipientGroupingOptions): void => {
  if (!isTspEnvelope({ signatureLevel })) {
    return;
  }

  const seenOrders = new Set<number>();

  for (const recipient of recipients) {
    if (isCcRecipient(recipient)) {
      continue;
    }

    const order = effectiveSigningOrder(recipient);

    if (seenOrders.has(order)) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Envelopes signed at '${signatureLevel}' cannot place two recipients in the same signing step — a signing group is parallel signing within one step, which breaks the per-recipient /ByteRange invariant TSP signatures rely on. Give every signing recipient a distinct signingOrder.`,
      });
    }

    seenOrders.add(order);
  }
};
