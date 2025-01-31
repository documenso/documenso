import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import slugify from '@sindresorhus/slugify';
import { type JWT } from 'next-auth/jwt';
import path from 'node:path';

import { env } from '@documenso/lib/utils/env';

import { APP_BASE_URL } from '../../constants/app';
import { ONE_HOUR, ONE_SECOND } from '../../constants/time';
import { alphaid } from '../id';

export const getPresignPostUrl = async (fileName: string, contentType: string) => {
  const client = getS3Client();

  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

  const token: JWT | null = null;

  try {
    const baseUrl = APP_BASE_URL() ?? 'http://localhost:3000';

    // Todo
    // token = await getToken({
    //   req: new NextRequest(baseUrl, {
    //     headers: headers(),
    //   }),
    // });
  } catch (err) {
    // Non server-component environment
  }

  // Get the basename and extension for the file
  const { name, ext } = path.parse(fileName);

  let key = `${alphaid(12)}/${slugify(name)}${ext}`;

  if (token) {
    key = `${token.id}/${key}`;
  }

  const putObjectCommand = new PutObjectCommand({
    Bucket: env('NEXT_PRIVATE_UPLOAD_BUCKET'),
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(client, putObjectCommand, {
    expiresIn: ONE_HOUR / ONE_SECOND,
  });

  return { key, url };
};

export const getAbsolutePresignPostUrl = async (key: string) => {
  const client = getS3Client();

  const { getSignedUrl: getS3SignedUrl } = await import('@aws-sdk/s3-request-presigner');

  const putObjectCommand = new PutObjectCommand({
    Bucket: env('NEXT_PRIVATE_UPLOAD_BUCKET'),
    Key: key,
  });

  const url = await getS3SignedUrl(client, putObjectCommand, {
    expiresIn: ONE_HOUR / ONE_SECOND,
  });

  return { key, url };
};

export const getPresignGetUrl = async (key: string) => {
  if (env('NEXT_PRIVATE_UPLOAD_DISTRIBUTION_DOMAIN')) {
    const distributionUrl = new URL(key, `${env('NEXT_PRIVATE_UPLOAD_DISTRIBUTION_DOMAIN')}`);

    const { getSignedUrl: getCloudfrontSignedUrl } = await import('@aws-sdk/cloudfront-signer');

    const url = getCloudfrontSignedUrl({
      url: distributionUrl.toString(),
      keyPairId: `${env('NEXT_PRIVATE_UPLOAD_DISTRIBUTION_KEY_ID')}`,
      privateKey: `${env('NEXT_PRIVATE_UPLOAD_DISTRIBUTION_KEY_CONTENTS')}`,
      dateLessThan: new Date(Date.now() + ONE_HOUR).toISOString(),
    });

    return { key, url };
  }

  const client = getS3Client();

  const { getSignedUrl: getS3SignedUrl } = await import('@aws-sdk/s3-request-presigner');

  const getObjectCommand = new GetObjectCommand({
    Bucket: env('NEXT_PRIVATE_UPLOAD_BUCKET'),
    Key: key,
  });

  const url = await getS3SignedUrl(client, getObjectCommand, {
    expiresIn: ONE_HOUR / ONE_SECOND,
  });

  return { key, url };
};

export const deleteS3File = async (key: string) => {
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: env('NEXT_PRIVATE_UPLOAD_BUCKET'),
      Key: key,
    }),
  );
};

const getS3Client = () => {
  const NEXT_PUBLIC_UPLOAD_TRANSPORT = env('NEXT_PUBLIC_UPLOAD_TRANSPORT');

  if (NEXT_PUBLIC_UPLOAD_TRANSPORT !== 's3') {
    throw new Error('Invalid upload transport');
  }

  const hasCredentials =
    env('NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID') && env('NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY');

  return new S3Client({
    endpoint: env('NEXT_PRIVATE_UPLOAD_ENDPOINT') || undefined,
    forcePathStyle: env('NEXT_PRIVATE_UPLOAD_FORCE_PATH_STYLE') === 'true',
    region: env('NEXT_PRIVATE_UPLOAD_REGION') || 'us-east-1',
    credentials: hasCredentials
      ? {
          accessKeyId: String(env('NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID')),
          secretAccessKey: String(env('NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY')),
        }
      : undefined,
  });
};
