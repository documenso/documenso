import { CreateEmailIdentityCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { EmailDomainStatus } from '@prisma/client';
import { generateKeyPair } from 'crypto';
import { promisify } from 'util';

import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { symmetricEncrypt } from '@documenso/lib/universal/crypto';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { generateEmailDomainRecords } from '@documenso/lib/utils/email-domains';
import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';

export const getSesClient = () => {
  const accessKeyId = env('NEXT_PRIVATE_SES_ACCESS_KEY_ID');
  const secretAccessKey = env('NEXT_PRIVATE_SES_SECRET_ACCESS_KEY');
  const region = env('NEXT_PRIVATE_SES_REGION');

  if (!accessKeyId || !secretAccessKey || !region) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Missing AWS SES credentials',
    });
  }

  return new SESv2Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};

/**
 * Removes first and last line, then removes all newlines
 */
const flattenKey = (key: string) => {
  return key.trim().split('\n').slice(1, -1).join('');
};

export async function verifyDomainWithDKIM(domain: string, selector: string, privateKey: string) {
  const command = new CreateEmailIdentityCommand({
    EmailIdentity: domain,
    DkimSigningAttributes: {
      DomainSigningSelector: selector,
      DomainSigningPrivateKey: privateKey,
    },
  });

  return await getSesClient().send(command);
}

type CreateEmailDomainOptions = {
  domain: string;
  organisationId: string;
};

type DomainRecord = {
  name: string;
  value: string;
  type: string;
};

export const createEmailDomain = async ({ domain, organisationId }: CreateEmailDomainOptions) => {
  const encryptionKey = DOCUMENSO_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('Missing DOCUMENSO_ENCRYPTION_KEY');
  }

  const selector = `documenso-${organisationId}`.replace(/[_.]/g, '-');
  const recordName = `${selector}._domainkey.${domain}`;

  // Check if domain already exists
  const existingDomain = await prisma.emailDomain.findUnique({
    where: {
      domain,
    },
  });

  if (existingDomain) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS, {
      message: 'Domain already exists in database',
    });
  }

  // Generate DKIM key pair
  const generateKeyPairAsync = promisify(generateKeyPair);

  const { publicKey, privateKey } = await generateKeyPairAsync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  // Format public key for DNS record
  const publicKeyFlattened = flattenKey(publicKey);
  const privateKeyFlattened = flattenKey(privateKey);

  // Create DNS records
  const records: DomainRecord[] = generateEmailDomainRecords(recordName, publicKeyFlattened);

  const encryptedPrivateKey = symmetricEncrypt({
    key: encryptionKey,
    data: privateKeyFlattened,
  });

  const emailDomain = await prisma.$transaction(async (tx) => {
    await verifyDomainWithDKIM(domain, selector, privateKeyFlattened).catch((err) => {
      if (err.name === 'AlreadyExistsException') {
        throw new AppError(AppErrorCode.ALREADY_EXISTS, {
          message: 'Domain already exists in SES',
        });
      }

      throw err;
    });

    // Create email domain record.
    return await tx.emailDomain.create({
      data: {
        id: generateDatabaseId('email_domain'),
        domain,
        status: EmailDomainStatus.PENDING,
        organisationId,
        selector: recordName,
        publicKey: publicKeyFlattened,
        privateKey: encryptedPrivateKey,
      },
      select: {
        id: true,
        status: true,
        organisationId: true,
        domain: true,
        selector: true,
        publicKey: true,
        createdAt: true,
        updatedAt: true,
        emails: true,
      },
    });
  });

  return {
    emailDomain,
    records,
  };
};
