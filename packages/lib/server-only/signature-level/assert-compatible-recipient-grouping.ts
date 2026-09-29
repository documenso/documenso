import type { Recipient } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { isTspEnvelope } from '../../types/signature-level';
import { hasSigningOrder, isCcRecipient } from '../../utils/recipients';

type GroupableRecipient = Pick<Recipient, 'role'> & { signingOrder?: number | null };

type AssertCompatibleRecipientGroupingOptions = {
  signatureLevel: string;
  recipients: GroupableRecipient[];

  /**
   * Recipients this request leaves untouched. A request may not join their
   * steps, but they are never validated against each other: legacy duplicates
   * are sequenced strictly at runtime instead.
   */
  existingRecipients?: GroupableRecipient[];
};

/**
 * Reject newly requested signing groups on AES/QES envelopes: group members
 * may sign at the same time, and a TSP signature computed over a document
 * snapshot would be invalidated by an overlapping signer.
 *
 * An omitted order never forms a group (it is numbered on creation, or
 * sequenced by id for legacy rows). CC recipients never sign and are ignored.
 */
export const assertCompatibleRecipientGrouping = ({
  signatureLevel,
  recipients,
  existingRecipients = [],
}: AssertCompatibleRecipientGroupingOptions): void => {
  if (!isTspEnvelope({ signatureLevel })) {
    return;
  }

  const takenOrders = new Set<number>();

  for (const recipient of existingRecipients) {
    if (!isCcRecipient(recipient) && hasSigningOrder(recipient)) {
      takenOrders.add(recipient.signingOrder);
    }
  }

  for (const recipient of recipients) {
    if (isCcRecipient(recipient) || !hasSigningOrder(recipient)) {
      continue;
    }

    if (takenOrders.has(recipient.signingOrder)) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Envelopes signed at '${signatureLevel}' cannot place two recipients in the same signing step — a signing group is parallel signing within one step, which breaks the per-recipient /ByteRange invariant TSP signatures rely on. Give every signing recipient a distinct signingOrder or omit it.`,
      });
    }

    takenOrders.add(recipient.signingOrder);
  }
};
