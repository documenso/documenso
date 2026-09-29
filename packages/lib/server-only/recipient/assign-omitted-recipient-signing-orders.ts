import type { Recipient } from '@prisma/client';

import { hasSigningOrder, isCcRecipient } from '../../utils/recipients';

type OrderableRecipient = Pick<Recipient, 'role'> & { signingOrder?: number | null };

type AssignOmittedRecipientSigningOrdersOptions<T> = {
  recipients: T[];
  existingRecipients?: OrderableRecipient[];
};

/**
 * Numbers signing recipients created without an order after the highest
 * explicit order on the envelope, in request order.
 */
export const assignOmittedRecipientSigningOrders = <T extends OrderableRecipient>({
  recipients,
  existingRecipients = [],
}: AssignOmittedRecipientSigningOrdersOptions<T>): T[] => {
  // Numbers sort ahead of unordered rows, so numbering an addition would move
  // it in front of a legacy unordered signer. Left unordered it queues behind
  // that tail by id.
  const hasUnorderedExistingSigner = existingRecipients.some(
    (recipient) => !isCcRecipient(recipient) && !hasSigningOrder(recipient),
  );

  if (hasUnorderedExistingSigner) {
    return recipients;
  }

  let highestOrder = 0;

  for (const recipient of [...existingRecipients, ...recipients]) {
    if (hasSigningOrder(recipient)) {
      highestOrder = Math.max(highestOrder, recipient.signingOrder);
    }
  }

  let nextOrder = highestOrder + 1;

  return recipients.map((recipient) => {
    if (isCcRecipient(recipient) || hasSigningOrder(recipient)) {
      return recipient;
    }

    const signingOrder = nextOrder;

    nextOrder += 1;

    return { ...recipient, signingOrder };
  });
};

type ReplacementRecipient = OrderableRecipient & { id?: number | null };

type ResolveReplacedRecipientSigningOrdersOptions<T> = {
  recipients: T[];
  existingRecipients: Array<Pick<Recipient, 'id' | 'role' | 'signingOrder'>>;
};

/**
 * Resolves signing orders for a full recipient replacement (`set*Recipients`):
 * a persisted recipient whose order was omitted keeps it, new recipients are
 * numbered after the kept ones.
 *
 * `requestedOrderRecipients` is the subset whose order differs from what was
 * persisted — the only entries that can form a new signing group.
 */
export const resolveReplacedRecipientSigningOrders = <T extends ReplacementRecipient>({
  recipients,
  existingRecipients,
}: ResolveReplacedRecipientSigningOrdersOptions<T>): { recipients: T[]; requestedOrderRecipients: T[] } => {
  const persistedById = new Map(existingRecipients.map((recipient) => [recipient.id, recipient]));

  const findPersisted = (recipient: T) =>
    typeof recipient.id === 'number' ? persistedById.get(recipient.id) : undefined;

  const preserved = recipients.map((recipient) => {
    const persisted = findPersisted(recipient);

    if (!persisted || hasSigningOrder(recipient)) {
      return recipient;
    }

    return { ...recipient, signingOrder: persisted.signingOrder };
  });

  const keptRecipients = preserved.filter((recipient) => findPersisted(recipient) !== undefined);
  const newRecipients = preserved.filter((recipient) => findPersisted(recipient) === undefined);

  const numberedNewRecipients = assignOmittedRecipientSigningOrders({
    recipients: newRecipients,
    existingRecipients: keptRecipients,
  });

  let numberedIndex = 0;

  const resolved = preserved.map((recipient) => {
    if (findPersisted(recipient) !== undefined) {
      return recipient;
    }

    const numbered = numberedNewRecipients[numberedIndex];

    numberedIndex += 1;

    return numbered;
  });

  const requestedOrderRecipients = resolved.filter((_recipient, index) => {
    const requested = recipients[index];
    const persisted = findPersisted(requested);

    return hasSigningOrder(requested) && (!persisted || persisted.signingOrder !== requested.signingOrder);
  });

  return { recipients: resolved, requestedOrderRecipients };
};
