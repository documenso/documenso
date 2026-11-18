import { RecipientRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  assignOmittedRecipientSigningOrders,
  resolveReplacedRecipientSigningOrders,
} from './assign-omitted-recipient-signing-orders';

const signer = (signingOrder?: number | null, id?: number) => ({
  id,
  role: RecipientRole.SIGNER,
  signingOrder,
});

const cc = () => ({ role: RecipientRole.CC, signingOrder: undefined });

const ordersOf = (recipients: Array<{ signingOrder?: number | null }>) =>
  recipients.map((recipient) => recipient.signingOrder);

describe('assignOmittedRecipientSigningOrders', () => {
  it('numbers omitted orders after the highest explicit order, in request order', () => {
    const result = assignOmittedRecipientSigningOrders({
      recipients: [signer(), signer(4), signer(), signer(1)],
    });

    expect(ordersOf(result)).toEqual([5, 4, 6, 1]);
  });

  it('continues after the highest order already on the envelope and never numbers CC recipients', () => {
    const result = assignOmittedRecipientSigningOrders({
      recipients: [cc(), signer(), signer()],
      existingRecipients: [signer(2), signer(7), cc()],
    });

    expect(ordersOf(result)).toEqual([undefined, 8, 9]);
  });

  it('leaves additions unordered when a signing recipient on the envelope has no order', () => {
    const result = assignOmittedRecipientSigningOrders({
      recipients: [signer(), signer(9)],
      existingRecipients: [signer(1), signer(null)],
    });

    expect(ordersOf(result)).toEqual([undefined, 9]);
  });
});

describe('resolveReplacedRecipientSigningOrders', () => {
  const existingRecipients = [signer(1, 10), signer(2, 11)] as Array<{
    id: number;
    role: RecipientRole;
    signingOrder: number | null;
  }>;

  it('keeps the persisted order of a recipient whose order was omitted', () => {
    const { recipients, requestedOrderRecipients } = resolveReplacedRecipientSigningOrders({
      recipients: [signer(undefined, 11), signer(undefined, 10)],
      existingRecipients,
    });

    expect(ordersOf(recipients)).toEqual([2, 1]);
    expect(requestedOrderRecipients).toEqual([]);
  });

  it('numbers new recipients after the kept ones and reports explicitly requested orders', () => {
    const { recipients, requestedOrderRecipients } = resolveReplacedRecipientSigningOrders({
      recipients: [signer(undefined, 10), signer(), signer(5, 11), signer()],
      existingRecipients,
    });

    expect(ordersOf(recipients)).toEqual([1, 6, 5, 7]);
    expect(requestedOrderRecipients).toEqual([recipients[2]]);
  });

  it('does not report an unchanged persisted order as requested', () => {
    const { requestedOrderRecipients } = resolveReplacedRecipientSigningOrders({
      recipients: [signer(1, 10), signer(3)],
      existingRecipients,
    });

    expect(ordersOf(requestedOrderRecipients)).toEqual([3]);
  });
});
