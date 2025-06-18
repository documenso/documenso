import { CreateEmailIdentityCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { EmailDomainStatus } from '@prisma/client';
import { generateKeyPair } from 'crypto';
import { promisify } from 'util';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';

export const getSesClient = () => {
  const accessKeyId = env('NEXT_PRIVATE_SES_ACCESS_KEY_ID');
  const secretAccessKey = env('NEXT_PRIVATE_SES_SECRET_ACCESS_KEY');

  if (!accessKeyId || !secretAccessKey) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Missing AWS SES credentials',
    });
  }

  return new SESv2Client({
    region: 'eu-central-1',
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

  await getSesClient().send(command);
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
  const selector = `documenso-${organisationId.replace('_', '-')}`;

  // Validate domain format
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  if (!domainRegex.test(domain)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid domain format',
    });
  }

  // Check if domain already exists
  const existingDomain = await prisma.emailDomain.findUnique({
    where: {
      domain,
    },
  });

  if (existingDomain) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS, {
      message: 'Domain already exists',
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
  const records: DomainRecord[] = [
    {
      name: `${selector}._domainkey.${domain}`,
      value: `v=DKIM1; k=rsa; p=${publicKeyFlattened}`,
      type: 'TXT',
    },
  ];

  const emailDomain = await prisma.$transaction(async (tx) => {
    await verifyDomainWithDKIM(domain, selector, privateKeyFlattened);

    // Create email domain record
    return await tx.emailDomain.create({
      data: {
        id: generateDatabaseId('email_domain'),
        domain,
        status: EmailDomainStatus.PENDING,
        organisationId,
        privateKey, // Todo: (email) Encrypt this.
        // Todo: store selector
      },
      omit: {
        privateKey: true,
      },
    });
  });

  return {
    emailDomain,
    records,
  };
};
