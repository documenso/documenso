import { parsePem } from '@libpdf/core';
import fs from 'node:fs';

import { env } from '@documenso/lib/utils/env';

import { AwsKmsSigner } from '../lib/aws-kms-signer';

const loadCertificates = async (): Promise<Uint8Array[]> => {
  // Try chain file first (takes precedence).
  const chainContents = env('NEXT_PRIVATE_SIGNING_AWS_KMS_CERT_CHAIN_CONTENTS');
  const chainFilePath = env('NEXT_PRIVATE_SIGNING_AWS_KMS_CERT_CHAIN_FILE_PATH');

  if (chainContents) {
    return parsePem(Buffer.from(chainContents, 'base64').toString('utf-8')).map(
      (block) => block.der,
    );
  }

  if (chainFilePath) {
    return parsePem(fs.readFileSync(chainFilePath).toString('utf-8')).map((block) => block.der);
  }

  // Fall back to single public certificate.
  const certContents = env('NEXT_PRIVATE_SIGNING_AWS_KMS_PUBLIC_CRT_FILE_CONTENTS');
  const certFilePath = env('NEXT_PRIVATE_SIGNING_AWS_KMS_PUBLIC_CRT_FILE_PATH');

  if (certContents) {
    return parsePem(Buffer.from(certContents, 'base64').toString('utf-8')).map(
      (block) => block.der,
    );
  }

  if (certFilePath) {
    return parsePem(fs.readFileSync(certFilePath).toString('utf-8')).map((block) => block.der);
  }

  // Last-resort: AWS Secrets Manager.
  const secretArn = env('NEXT_PRIVATE_SIGNING_AWS_KMS_SECRETS_MANAGER_CERT_ARN');

  if (secretArn) {
    const region = env('NEXT_PRIVATE_SIGNING_AWS_KMS_REGION');
    const { cert, chain } = await AwsKmsSigner.getCertificateFromSecretsManager(
      secretArn,
      region ? { region } : undefined,
    );

    if (chain) {
      return [cert, ...chain];
    }

    return [cert];
  }

  throw new Error('No certificate found for AWS KMS signing');
};

export const createAwsKmsSigner = async () => {
  const keyId = env('NEXT_PRIVATE_SIGNING_AWS_KMS_KEY_ID');

  if (!keyId) {
    throw new Error('NEXT_PRIVATE_SIGNING_AWS_KMS_KEY_ID is required for AWS KMS signing');
  }

  const region = env('NEXT_PRIVATE_SIGNING_AWS_KMS_REGION');

  const certs = await loadCertificates();

  if (certs.length === 0) {
    throw new Error('No valid certificates found');
  }

  return AwsKmsSigner.create({
    keyId,
    region,
    certificate: certs[0],
    certificateChain: certs.length > 1 ? certs.slice(1) : undefined,
  });
};
