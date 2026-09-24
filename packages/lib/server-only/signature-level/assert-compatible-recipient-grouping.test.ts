import { RecipientRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { SignatureLevel } from '../../types/signature-level';
import { assertCompatibleRecipientGrouping } from './assert-compatible-recipient-grouping';

const signer = (signingOrder: number | null) => ({ role: RecipientRole.SIGNER, signingOrder });
const cc = (signingOrder: number | null) => ({ role: RecipientRole.CC, signingOrder });

const expectRejected = (
  signatureLevel: string,
  recipients: Array<{ role: RecipientRole; signingOrder: number | null }>,
) => {
  expect(() => assertCompatibleRecipientGrouping({ signatureLevel, recipients })).toThrow(
    /signing group|same signing step/i,
  );
};

const expectAccepted = (
  signatureLevel: string,
  recipients: Array<{ role: RecipientRole; signingOrder: number | null }>,
) => {
  expect(() => assertCompatibleRecipientGrouping({ signatureLevel, recipients })).not.toThrow();
};

describe('assertCompatibleRecipientGrouping', () => {
  describe('AES/QES envelopes', () => {
    for (const signatureLevel of [SignatureLevel.AES, SignatureLevel.QES]) {
      it(`rejects two signers sharing a signing order (${signatureLevel})`, () => {
        expectRejected(signatureLevel, [signer(1), signer(2), signer(2)]);
      });

      it(`accepts distinct signing orders (${signatureLevel})`, () => {
        expectAccepted(signatureLevel, [signer(1), signer(2), signer(3)]);
      });
    }

    // Every null order collapses into the same tail step, so two of them sign
    // in parallel exactly as a duplicate order would.
    it('rejects two signers without a signing order', () => {
      expectRejected(SignatureLevel.AES, [signer(null), signer(null)]);
    });

    it('rejects a signer without an order alongside an ordered signer', () => {
      // The unordered recipient shares the tail step with the other null.
      expectRejected(SignatureLevel.AES, [signer(1), signer(null), signer(null)]);
    });

    it('accepts a single signer without a signing order', () => {
      expectAccepted(SignatureLevel.AES, [signer(null)]);
    });

    it('accepts one ordered signer and one unordered signer', () => {
      expectAccepted(SignatureLevel.AES, [signer(1), signer(null)]);
    });

    // CC recipients never sign, so their order carries no meaning.
    it('ignores CC recipients sharing an order with a signer', () => {
      expectAccepted(SignatureLevel.AES, [signer(1), cc(1)]);
    });

    it('ignores several CC recipients sharing an order with each other', () => {
      expectAccepted(SignatureLevel.AES, [signer(1), cc(2), cc(2), cc(null), cc(null)]);
    });

    it('accepts an empty recipient list', () => {
      expectAccepted(SignatureLevel.AES, []);
    });
  });

  describe('SES envelopes', () => {
    it('permits signing groups', () => {
      expectAccepted(SignatureLevel.SES, [signer(1), signer(2), signer(2)]);
    });

    it('permits multiple unordered signers', () => {
      expectAccepted(SignatureLevel.SES, [signer(null), signer(null)]);
    });
  });
});
