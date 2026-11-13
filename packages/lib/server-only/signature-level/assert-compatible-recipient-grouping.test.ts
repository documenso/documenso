import { RecipientRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { SignatureLevel } from '../../types/signature-level';
import { assertCompatibleRecipientGrouping } from './assert-compatible-recipient-grouping';

type TestRecipient = { role: RecipientRole; signingOrder?: number | null };

const signer = (signingOrder?: number | null): TestRecipient => ({ role: RecipientRole.SIGNER, signingOrder });
const cc = (signingOrder?: number | null): TestRecipient => ({ role: RecipientRole.CC, signingOrder });

const expectRejected = (
  signatureLevel: string,
  recipients: TestRecipient[],
  existingRecipients: TestRecipient[] = [],
) => {
  expect(() => assertCompatibleRecipientGrouping({ signatureLevel, recipients, existingRecipients })).toThrow(
    /signing group|same signing step/i,
  );
};

const expectAccepted = (
  signatureLevel: string,
  recipients: TestRecipient[],
  existingRecipients: TestRecipient[] = [],
) => {
  expect(() => assertCompatibleRecipientGrouping({ signatureLevel, recipients, existingRecipients })).not.toThrow();
};

describe('assertCompatibleRecipientGrouping', () => {
  describe('AES/QES envelopes', () => {
    for (const signatureLevel of [SignatureLevel.AES, SignatureLevel.QES]) {
      it(`rejects two signers sharing an explicit signing order (${signatureLevel})`, () => {
        expectRejected(signatureLevel, [signer(1), signer(2), signer(2)]);
      });

      it(`accepts distinct signing orders (${signatureLevel})`, () => {
        expectAccepted(signatureLevel, [signer(1), signer(2), signer(3)]);
      });
    }

    it('rejects a new signer joining a step that already exists on the envelope', () => {
      expectRejected(SignatureLevel.AES, [signer(1)], [signer(1)]);
    });

    it('accepts any number of signers without a signing order', () => {
      expectAccepted(SignatureLevel.AES, [signer(), signer(null), signer(undefined)]);
      expectAccepted(SignatureLevel.AES, [signer(1), signer(), signer()], [signer(null), signer(null)]);
    });

    it('does not validate untouched existing recipients against each other', () => {
      expectAccepted(SignatureLevel.AES, [signer(3)], [signer(1), signer(1)]);
    });

    it('ignores CC recipients', () => {
      expectAccepted(SignatureLevel.AES, [signer(1), cc(1), cc(1)], [cc(1)]);
    });
  });

  describe('SES envelopes', () => {
    it('permits signing groups', () => {
      expectAccepted(SignatureLevel.SES, [signer(1), signer(2), signer(2)], [signer(2)]);
    });
  });
});
