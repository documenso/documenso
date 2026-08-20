import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '@documenso/lib/utils/env';
import slugify from '@sindresorhus/slugify';

import { ONE_HOUR, ONE_SECOND } from '../../../constants/time';
import { alphaid } from '../../id';
import type { PresignedUrl, StorageProvider, UploadFileInput, UploadFileResult } from './storage-provider';

export class S3Provider implements StorageProvider {
  private client: S3Client;

  constructor() {
    const hasCredentials = env('NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID') && env('NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY');

    this.client = new S3Client({
      endpoint: env('NEXT_PRIVATE_UPLOAD_ENDPOINT') || undefined,
      forcePathStyle: env('NEXT_PRIVATE_UPLOAD_FORCE_PATH_STYLE') === 'true',
      region: env('NEXT_PRIVATE_UPLOAD_REGION') || 'us-east-1',
      // Since v3.729 the AWS SDK adds a CRC32 checksum to every request by default
      // (`requestChecksumCalculation: 'WHEN_SUPPORTED'`). Many S3-compatible providers
      // (GarageHQ, MinIO, Backblaze B2, etc.) reject those requests with an
      // `InvalidDigest` error, which breaks uploads against third-party storage. Only
      // send/validate checksums when the operation actually requires them so the default
      // configuration keeps working with non-AWS backends.
      //
      // Buckets with S3 Object Lock are the counter-case: S3 REQUIRES a
      // Content-MD5 or x-amz-checksum-* header on PutObject requests that
      // carry Object Lock parameters, and WHEN_REQUIRED sends neither — the
      // seal write fails with "Content-MD5 OR x-amz-checksum- HTTP header is
      // required" and documents stay PENDING after all recipients signed.
      // Because the value is set explicitly here, the SDK's standard
      // AWS_REQUEST_CHECKSUM_CALCULATION env var is also disabled, so operators
      // had no way to opt in. A dedicated env var restores that choice without
      // changing the WHEN_REQUIRED default third-party backends depend on
      // (#3282). The ternary preserves the literal union type — reading the
      // env value directly widens it to string and fails typecheck.
      requestChecksumCalculation:
        env('NEXT_PRIVATE_UPLOAD_CHECKSUM_CALCULATION') === 'WHEN_SUPPORTED'
          ? 'WHEN_SUPPORTED'
          : 'WHEN_REQUIRED',
      responseChecksumValidation:
        env('NEXT_PRIVATE_UPLOAD_CHECKSUM_CALCULATION') === 'WHEN_SUPPORTED'
          ? 'WHEN_SUPPORTED'
          : 'WHEN_REQUIRED',
      credentials: hasCredentials
        ? {
            accessKeyId: String(env('NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID')),
            secretAccessKey: String(env('NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY')),
          }
        : undefined,
    });
  }

  async getPresignPostUrl(fileName: string, contentType: string, userId?: number): Promise<PresignedUrl> {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const { name, ext } = path.parse(fileName);

    let slugified = slugify(name);
    if (slugified.length === 0 || slugified.length > 100) {
      slugified = alphaid(8);
    }

    let key = `${alphaid(12)}/${slugified}${ext}`;
    if (userId) {
      key = `${userId}/${key}`;
    }

    const command = new PutObjectCommand({
      Bucket: env('NEXT_PRIVATE_UPLOAD_BUCKET'),
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: ONE_HOUR / ONE_SECOND });
    return { key, url };
  }

  async getAbsolutePresignPostUrl(key: string): Promise<PresignedUrl> {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const command = new PutObjectCommand({
      Bucket: env('NEXT_PRIVATE_UPLOAD_BUCKET'),
      Key: key,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: ONE_HOUR / ONE_SECOND });
    return { key, url };
  }

  async getPresignGetUrl(key: string): Promise<PresignedUrl> {
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

    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const command = new GetObjectCommand({
      Bucket: env('NEXT_PRIVATE_UPLOAD_BUCKET'),
      Key: key,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: ONE_HOUR / ONE_SECOND });
    return { key, url };
  }

  async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    const { name, ext } = path.parse(input.name);

    const key = `${alphaid(12)}/${slugify(name)}${ext}`;

    const body = input.body instanceof ArrayBuffer ? Buffer.from(input.body) : input.body;

    await this.client.send(
      new PutObjectCommand({
        Bucket: env('NEXT_PRIVATE_UPLOAD_BUCKET'),
        Key: key,
        Body: body,
        ContentType: input.type,
      }),
    );

    return { key };
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: env('NEXT_PRIVATE_UPLOAD_BUCKET'),
        Key: key,
      }),
    );
  }
}
