import { RecipientRole } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { isTspEnvelope } from '../../types/signature-level';

type AssertCompatibleRecipientRoleOptions = {
  signatureLevel: string;
  role: RecipientRole;
};

/**
 * Reject `RecipientRole.ASSISTANT` on AES/QES envelopes.
 *
 * Assistant recipients pre-fill fields on behalf of downstream signers. The
 * TSP flow signs each recipient's complete PDF state with their own CSC
 * credential, so an assistant role has no sign-time identity to bind to and
 * `prepareCscRecipientSigning` has no handler for it.
 *
 * SES envelopes pass through unchanged.
 */
export const assertCompatibleRecipientRole = ({ signatureLevel, role }: AssertCompatibleRecipientRoleOptions): void => {
  if (!isTspEnvelope({ signatureLevel })) {
    return;
  }

  if (role === RecipientRole.ASSISTANT) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Envelopes signed at '${signatureLevel}' do not support the ASSISTANT role — the TSP flow signs each recipient's bytes with their own CSC credential and has no sign-time path for an assistant.`,
    });
  }

  return;
};
