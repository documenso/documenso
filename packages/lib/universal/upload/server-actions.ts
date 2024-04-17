'use server';

<<<<<<< HEAD
=======
import { headers } from 'next/headers';
import { NextRequest } from 'next/server';

>>>>>>> main
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
<<<<<<< HEAD
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import slugify from '@sindresorhus/slugify';
import path from 'node:path';

import { ONE_HOUR, ONE_SECOND } from '../../constants/time';
import { getServerComponentSession } from '../../next-auth/get-server-session';
=======
import slugify from '@sindresorhus/slugify';
import { type JWT, getToken } from 'next-auth/jwt';
import { env } from 'next-runtime-env';
import path from 'node:path';

import { APP_BASE_URL } from '../../constants/app';
import { ONE_HOUR, ONE_SECOND } from '../../constants/time';
>>>>>>> main
import { alphaid } from '../id';

export const getPresignPostUrl = async (fileName: string, contentType: string) => {
  const client = getS3Client();

<<<<<<< HEAD
  const { user } = await getServerComponentSession();
=======
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

  let token: JWT | null = null;

  try {
    const baseUrl = APP_BASE_URL() ?? 'http://localhost:3000';

    token = await getToken({
      req: new NextRequest(baseUrl, {
        headers: headers(),
      }),
    });
  } catch (err) {
    // Non server-component environment
  }
>>>>>>> main

  // Get the basename and extension for the file
  const { name, ext } = path.parse(fileName);

  let key = `${alphaid(12)}/${slugify(name)}${ext}`;

<<<<<<< HEAD
  if (user) {
    key = `${user.id}/${key}`;
=======
  if (token) {
    key = `${token.id}/${key}`;
>>>>>>> main
  }

  const putObjectCommand = new PutObjectCommand({
    Bucket: process.env.NEXT_PRIVATE_UPLOAD_BUCKET,
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

<<<<<<< HEAD
=======
  const { getSignedUrl: getS3SignedUrl } = await import('@aws-sdk/s3-request-presigner');

>>>>>>> main
  const putObjectCommand = new PutObjectCommand({
    Bucket: process.env.NEXT_PRIVATE_UPLOAD_BUCKET,
    Key: key,
  });

<<<<<<< HEAD
  const url = await getSignedUrl(client, putObjectCommand, {
=======
  const url = await getS3SignedUrl(client, putObjectCommand, {
>>>>>>> main
    expiresIn: ONE_HOUR / ONE_SECOND,
  });

  return { key, url };
};

export const getPresignGetUrl = async (key: string) => {
<<<<<<< HEAD
  const client = getS3Client();

=======
  if (process.env.NEXT_PRIVATE_UPLOAD_DISTRIBUTION_DOMAIN) {
    const distributionUrl = new URL(key, `${process.env.NEXT_PRIVATE_UPLOAD_DISTRIBUTION_DOMAIN}`);

    const { getSignedUrl: getCloudfrontSignedUrl } = await import('@aws-sdk/cloudfront-signer');

    const url = getCloudfrontSignedUrl({
      url: distributionUrl.toString(),
      keyPairId: `${process.env.NEXT_PRIVATE_UPLOAD_DISTRIBUTION_KEY_ID}`,
      privateKey: `${process.env.NEXT_PRIVATE_UPLOAD_DISTRIBUTION_KEY_CONTENTS}`,
      dateLessThan: new Date(Date.now() + ONE_HOUR).toISOString(),
    });

    return { key, url };
  }

  const client = getS3Client();

  const { getSignedUrl: getS3SignedUrl } = await import('@aws-sdk/s3-request-presigner');

>>>>>>> main
  const getObjectCommand = new GetObjectCommand({
    Bucket: process.env.NEXT_PRIVATE_UPLOAD_BUCKET,
    Key: key,
  });

<<<<<<< HEAD
  const url = await getSignedUrl(client, getObjectCommand, {
=======
  const url = await getS3SignedUrl(client, getObjectCommand, {
>>>>>>> main
    expiresIn: ONE_HOUR / ONE_SECOND,
  });

  return { key, url };
};

export const deleteS3File = async (key: string) => {
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.NEXT_PRIVATE_UPLOAD_BUCKET,
      Key: key,
    }),
  );
};

const getS3Client = () => {
<<<<<<< HEAD
  if (process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT !== 's3') {
=======
  const NEXT_PUBLIC_UPLOAD_TRANSPORT = env('NEXT_PUBLIC_UPLOAD_TRANSPORT');

  if (NEXT_PUBLIC_UPLOAD_TRANSPORT !== 's3') {
>>>>>>> main
    throw new Error('Invalid upload transport');
  }

  const hasCredentials =
    process.env.NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID &&
    process.env.NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY;

  return new S3Client({
    endpoint: process.env.NEXT_PRIVATE_UPLOAD_ENDPOINT || undefined,
<<<<<<< HEAD
=======
    forcePathStyle: process.env.NEXT_PRIVATE_UPLOAD_FORCE_PATH_STYLE === 'true',
>>>>>>> main
    region: process.env.NEXT_PRIVATE_UPLOAD_REGION || 'us-east-1',
    credentials: hasCredentials
      ? {
          accessKeyId: String(process.env.NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID),
          secretAccessKey: String(process.env.NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY),
        }
      : undefined,
  });
};
