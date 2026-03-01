import { DeleteEmailIdentityCommand } from '@aws-sdk/client-sesv2';
import { EmailDomainStatus } from '@documenso/prisma/client';

import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { symmetricDecrypt } from '@documenso/lib/universal/crypto';
import { prisma } from '@documenso/prisma';

import { getSesClient, verifyDomainWithDKIM } from './create-email-domain';

type ReregisterEmailDomainOptions = {
  emailDomainId: string;
};

/**
 * Re-register an email domain in SES using the same DKIM key pair.
 *
 * This deletes the existing SES identity and recreates it with the same
 * selector and private key, so the user does not need to update their DNS records.
 *
 * Permission is assumed to be checked in the caller.
 */
export const reregisterEmailDomain = async ({ emailDomainId }: ReregisterEmailDomainOptions) => {
  const encryptionKey = DOCUMENSO_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('Missing DOCUMENSO_ENCRYPTION_KEY');
  }

  const emailDomain = await prisma.emailDomain.findUnique({
    where: {
      id: emailDomainId,
    },
  });

  if (!emailDomain) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Email domain not found',
    });
  }

  const sesClient = getSesClient();

  // Delete the existing SES identity, ignoring if it no longer exists.
  await sesClient
    .send(
      new DeleteEmailIdentityCommand({
        EmailIdentity: emailDomain.domain,
      }),
    )
    .catch((err) => {
      if (err.name === 'NotFoundException') {
        return;
      }

      throw err;
    });

  // Decrypt the stored private key.
  const decryptedPrivateKeyBytes = symmetricDecrypt({
    key: encryptionKey,
    data: emailDomain.privateKey,
  });

  const decryptedPrivateKey = new TextDecoder().decode(decryptedPrivateKeyBytes);

  // The selector field in the DB is the full record name (e.g. "documenso-orgid._domainkey.example.com").
  // We need to extract just the selector part (before "._domainkey.").
  const selectorParts = emailDomain.selector.split('._domainkey.');
  const selector = selectorParts[0];

  if (!selector) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Could not extract selector from email domain record',
    });
  }

  // Recreate the SES identity with the same DKIM key pair.
  await verifyDomainWithDKIM(emailDomain.domain, selector, decryptedPrivateKey);

  // Reset status to PENDING and update lastVerifiedAt.
  const updatedEmailDomain = await prisma.emailDomain.update({
    where: {
      id: emailDomainId,
    },
    data: {
      status: EmailDomainStatus.PENDING,
      lastVerifiedAt: new Date(),
    },
  });

  return updatedEmailDomain;
};
