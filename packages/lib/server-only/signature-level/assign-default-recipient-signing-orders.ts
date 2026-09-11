import type { Recipient } from '@prisma/client';

import { isTspEnvelope } from '../../types/signature-level';
import { isCcRecipient } from '../../utils/recipients';

type AssignDefaultRecipientSigningOrdersOptions<T> = {
  signatureLevel: string;

  /**
   * The recipients supplied by the caller, which should already be validated by
   * {@link assertCompatibleRecipientGrouping}.
   */
  payloadRecipients: Array<Pick<Recipient, 'role'> & { signingOrder?: number | null }>;

  /**
   * The team default recipients to append.
   */
  defaultRecipients: T[];
};

/**
 * Assigns distinct signing orders to default recipients appended to a
 * TSP (AES/QES) envelope.
 *
 * Default recipients carry no signing order, so on a TSP envelope two or more of
 * them would share the unordered tail step — a signing group, which TSP
 * signatures cannot hold
 *
 * CC defaults are left unordered: they never sign and are ignored by the
 * grouping assertion.
 *
 * SES envelopes pass through unchanged — shared steps are an SES feature.
 */
export const assignDefaultRecipientSigningOrders = <T extends Pick<Recipient, 'role'>>({
  signatureLevel,
  payloadRecipients,
  defaultRecipients,
}: AssignDefaultRecipientSigningOrdersOptions<T>): Array<T & { signingOrder?: number }> => {
  if (!isTspEnvelope({ signatureLevel })) {
    return defaultRecipients;
  }

  let nextOrder =
    payloadRecipients.reduce((highest, recipient) => Math.max(highest, recipient.signingOrder ?? 0), 0) + 1;

  return defaultRecipients.map((recipient) => {
    if (isCcRecipient(recipient)) {
      return recipient;
    }

    const signingOrder = nextOrder;

    nextOrder += 1;

    return { ...recipient, signingOrder };
  });
};
