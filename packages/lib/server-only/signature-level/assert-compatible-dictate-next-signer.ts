import { AppError, AppErrorCode } from '../../errors/app-error';
import { isTspEnvelope } from '../../types/signature-level';

type AssertCompatibleDictateNextSignerOptions = {
  signatureLevel: string;
  allowDictateNextSigner: boolean | null | undefined;
};

/**
 * Reject `allowDictateNextSigner = true` on AES/QES envelopes.
 *
 * The TSP sign path has no nextSigner dictation — `prepareCscRecipientSigning`
 * doesn't accept one and `executeTspSign` always advances to the strict
 * SEQUENTIAL next signer. Allowing the flag to persist on a TSP envelope
 * would advertise a UX feature the sign-time flow silently drops.
 *
 * SES envelopes pass through unchanged. A `null` / `undefined` /  `false`
 * value also passes through.
 */
export const assertCompatibleDictateNextSigner = ({
  signatureLevel,
  allowDictateNextSigner,
}: AssertCompatibleDictateNextSignerOptions): void => {
  if (!isTspEnvelope({ signatureLevel })) {
    return;
  }

  if (allowDictateNextSigner !== true) {
    return;
  }

  throw new AppError(AppErrorCode.INVALID_BODY, {
    message: `Envelopes signed at '${signatureLevel}' do not support next-signer dictation — the TSP sign path always advances to the strict SEQUENTIAL next recipient.`,
  });
};
