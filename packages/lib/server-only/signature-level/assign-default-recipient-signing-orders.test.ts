import { RecipientRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { assertCompatibleRecipientGrouping } from './assert-compatible-recipient-grouping';
import { assignDefaultRecipientSigningOrders } from './assign-default-recipient-signing-orders';

const signer = (signingOrder?: number | null) => ({
  role: RecipientRole.SIGNER,
  signingOrder,
});

const defaultRecipient = (email: string, role: RecipientRole = RecipientRole.SIGNER) => ({
  email,
  name: email,
  role,
});

describe('assignDefaultRecipientSigningOrders', () => {
  it('leaves defaults unordered on SES envelopes', () => {
    const result = assignDefaultRecipientSigningOrders({
      signatureLevel: 'SES',
      payloadRecipients: [signer(1), signer(2)],
      defaultRecipients: [defaultRecipient('a@example.com'), defaultRecipient('b@example.com')],
    });

    expect(result.map((recipient) => recipient.signingOrder)).toEqual([undefined, undefined]);
  });

  it.each(['AES', 'QES'])('assigns distinct orders after the payload max on %s envelopes', (signatureLevel) => {
    const result = assignDefaultRecipientSigningOrders({
      signatureLevel,
      payloadRecipients: [signer(1), signer(4)],
      defaultRecipients: [defaultRecipient('a@example.com'), defaultRecipient('b@example.com')],
    });

    expect(result.map((recipient) => recipient.signingOrder)).toEqual([5, 6]);
  });

  it('numbers defaults from 1 when the payload has no numeric orders', () => {
    const result = assignDefaultRecipientSigningOrders({
      signatureLevel: 'QES',
      payloadRecipients: [],
      defaultRecipients: [defaultRecipient('a@example.com'), defaultRecipient('b@example.com')],
    });

    expect(result.map((recipient) => recipient.signingOrder)).toEqual([1, 2]);
  });

  it('skips CC defaults while numbering the rest', () => {
    const result = assignDefaultRecipientSigningOrders({
      signatureLevel: 'AES',
      payloadRecipients: [signer(2)],
      defaultRecipients: [
        defaultRecipient('a@example.com'),
        defaultRecipient('cc@example.com', RecipientRole.CC),
        defaultRecipient('b@example.com'),
      ],
    });

    expect(result.map((recipient) => recipient.signingOrder)).toEqual([3, undefined, 4]);
  });

  it('produces a combined set that satisfies the TSP grouping assertion', () => {
    const payloadRecipients = [signer(1), signer(2)];

    const defaults = assignDefaultRecipientSigningOrders({
      signatureLevel: 'QES',
      payloadRecipients,
      defaultRecipients: [defaultRecipient('a@example.com'), defaultRecipient('b@example.com')],
    });

    expect(() =>
      assertCompatibleRecipientGrouping({
        signatureLevel: 'QES',
        recipients: [...payloadRecipients, ...defaults],
      }),
    ).not.toThrow();
  });

  it('remains assertion-compatible when the payload holds a single unordered recipient', () => {
    // The write-path assert permits one unordered recipient (no shared step);
    // numbered defaults must not collide with it.
    const payloadRecipients = [signer(null)];

    const defaults = assignDefaultRecipientSigningOrders({
      signatureLevel: 'AES',
      payloadRecipients,
      defaultRecipients: [defaultRecipient('a@example.com')],
    });

    expect(defaults.map((recipient) => recipient.signingOrder)).toEqual([1]);

    expect(() =>
      assertCompatibleRecipientGrouping({
        signatureLevel: 'AES',
        recipients: [...payloadRecipients, ...defaults],
      }),
    ).not.toThrow();
  });
});
