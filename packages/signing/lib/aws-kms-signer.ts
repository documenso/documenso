import {
  GetPublicKeyCommand,
  KMSClient,
  type KMSClientConfig,
  SignCommand,
  type SigningAlgorithmSpec,
} from '@aws-sdk/client-kms';
import {
  GetSecretValueCommand,
  SecretsManagerClient,
  type SecretsManagerClientConfig,
} from '@aws-sdk/client-secrets-manager';
import {
  type DigestAlgorithm,
  type KeyType,
  KmsSignerError,
  type SignatureAlgorithm,
  type Signer,
  parsePem,
} from '@libpdf/core';

type AlgorithmInfo = {
  keyType: KeyType;
  signatureAlgorithm: SignatureAlgorithm;
  digestAlgorithm: DigestAlgorithm;
};

/**
 * Map an AWS KMS SigningAlgorithmSpec to @libpdf/core's algorithm types.
 *
 * AWS KMS keys can support multiple signing algorithms (e.g. an RSA_2048 key can
 * sign with either PKCS1_V1_5 or PSS at SHA-256/384/512). The caller picks one
 * explicitly or we pick the first supported on the key.
 */
const KMS_ALGORITHM_MAP: Record<string, AlgorithmInfo> = {
  RSASSA_PKCS1_V1_5_SHA_256: {
    keyType: 'RSA',
    signatureAlgorithm: 'RSASSA-PKCS1-v1_5',
    digestAlgorithm: 'SHA-256',
  },
  RSASSA_PKCS1_V1_5_SHA_384: {
    keyType: 'RSA',
    signatureAlgorithm: 'RSASSA-PKCS1-v1_5',
    digestAlgorithm: 'SHA-384',
  },
  RSASSA_PKCS1_V1_5_SHA_512: {
    keyType: 'RSA',
    signatureAlgorithm: 'RSASSA-PKCS1-v1_5',
    digestAlgorithm: 'SHA-512',
  },
  RSASSA_PSS_SHA_256: {
    keyType: 'RSA',
    signatureAlgorithm: 'RSA-PSS',
    digestAlgorithm: 'SHA-256',
  },
  RSASSA_PSS_SHA_384: {
    keyType: 'RSA',
    signatureAlgorithm: 'RSA-PSS',
    digestAlgorithm: 'SHA-384',
  },
  RSASSA_PSS_SHA_512: {
    keyType: 'RSA',
    signatureAlgorithm: 'RSA-PSS',
    digestAlgorithm: 'SHA-512',
  },
  ECDSA_SHA_256: {
    keyType: 'EC',
    signatureAlgorithm: 'ECDSA',
    digestAlgorithm: 'SHA-256',
  },
  ECDSA_SHA_384: {
    keyType: 'EC',
    signatureAlgorithm: 'ECDSA',
    digestAlgorithm: 'SHA-384',
  },
  ECDSA_SHA_512: {
    keyType: 'EC',
    signatureAlgorithm: 'ECDSA',
    digestAlgorithm: 'SHA-512',
  },
};

const DIGEST_KEY_MAP: Record<DigestAlgorithm, 'sha256' | 'sha384' | 'sha512'> = {
  'SHA-256': 'sha256',
  'SHA-384': 'sha384',
  'SHA-512': 'sha512',
};

/**
 * Resolve a KMS SigningAlgorithmSpec string to `@libpdf/core` algorithm types.
 */
const mapKmsAlgorithm = (algorithm: string): AlgorithmInfo => {
  const info = KMS_ALGORITHM_MAP[algorithm];

  if (!info) {
    throw new KmsSignerError(`Unsupported AWS KMS signing algorithm: ${algorithm}`);
  }

  return info;
};

/** Whether an AWS KMS algorithm is RSA-PSS (Adobe compatibility note). */
const isRsaPss = (algorithm: string): boolean => algorithm.startsWith('RSASSA_PSS_');

type AwsKmsSignerCreateOptions = {
  /** KMS key ARN or key ID (e.g. `arn:aws:kms:us-east-1:123:key/abc` or `abc-id`) */
  keyId: string;
  /** AWS region of the key. Defaults to `AWS_REGION` env var if omitted. */
  region?: string;
  /**
   * Which signing algorithm to use. Optional; if omitted, the first
   * algorithm advertised by `GetPublicKey` is used.
   */
  signingAlgorithm?: SigningAlgorithmSpec;
  /** DER-encoded X.509 signing certificate. */
  certificate: Uint8Array;
  /** Optional DER-encoded cert chain [intermediate, ..., root]. */
  certificateChain?: Uint8Array[];
  /** Pre-configured KMS client. If omitted, one is created with the default credential chain. */
  client?: KMSClient;
};

/**
 * Signer that uses AWS KMS for asymmetric signing operations.
 *
 * Supports RSA and ECDSA keys stored in AWS KMS. The private key never leaves
 * KMS — only the digest is sent for signing.
 *
 * Credentials are resolved by the AWS SDK's default credential chain
 * (env vars, IAM task role, EC2/Lambda instance profile, shared credentials file).
 * No custom credential handling is performed.
 *
 * @example
 * ```typescript
 * const signer = await AwsKmsSigner.create({
 *   keyId: 'arn:aws:kms:us-east-1:123456789012:key/abcd-...',
 *   region: 'us-east-1',
 *   certificate: certDer,
 * });
 * ```
 */
export class AwsKmsSigner implements Signer {
  readonly certificate: Uint8Array;
  readonly certificateChain: Uint8Array[];
  readonly keyType: KeyType;
  readonly signatureAlgorithm: SignatureAlgorithm;
  readonly digestAlgorithm: DigestAlgorithm;
  readonly keyId: string;
  readonly kmsSigningAlgorithm: SigningAlgorithmSpec;

  private readonly client: KMSClient;

  private constructor(
    client: KMSClient,
    keyId: string,
    kmsSigningAlgorithm: SigningAlgorithmSpec,
    certificate: Uint8Array,
    certificateChain: Uint8Array[],
    keyType: KeyType,
    signatureAlgorithm: SignatureAlgorithm,
    digestAlgorithm: DigestAlgorithm,
  ) {
    this.client = client;
    this.keyId = keyId;
    this.kmsSigningAlgorithm = kmsSigningAlgorithm;
    this.certificate = certificate;
    this.certificateChain = certificateChain;
    this.keyType = keyType;
    this.signatureAlgorithm = signatureAlgorithm;
    this.digestAlgorithm = digestAlgorithm;
  }

  /**
   * Create an `AwsKmsSigner` from a KMS key reference and signing certificate.
   *
   * Calls `GetPublicKey` on the KMS key to determine which signing algorithms
   * the key supports, then validates or selects the signing algorithm to use.
   */
  static async create(options: AwsKmsSignerCreateOptions): Promise<AwsKmsSigner> {
    const clientConfig: KMSClientConfig = options.region ? { region: options.region } : {};
    const client = options.client ?? new KMSClient(clientConfig);

    let publicKeyResponse;

    try {
      publicKeyResponse = await client.send(new GetPublicKeyCommand({ KeyId: options.keyId }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new KmsSignerError(
        `Failed to fetch KMS public key for ${options.keyId}: ${message}`,
        error instanceof Error ? error : undefined,
      );
    }

    const supportedAlgorithms = publicKeyResponse.SigningAlgorithms ?? [];

    if (supportedAlgorithms.length === 0) {
      throw new KmsSignerError(
        `KMS key ${options.keyId} has no signing algorithms. ` +
          'Ensure the key usage is SIGN_VERIFY and the key spec is RSA or ECC.',
      );
    }

    const chosenAlgorithm = options.signingAlgorithm ?? supportedAlgorithms[0];

    if (options.signingAlgorithm && !supportedAlgorithms.includes(options.signingAlgorithm)) {
      throw new KmsSignerError(
        `Requested signing algorithm ${options.signingAlgorithm} is not supported by KMS key ` +
          `${options.keyId}. Supported: ${supportedAlgorithms.join(', ')}`,
      );
    }

    const algorithmInfo = mapKmsAlgorithm(chosenAlgorithm);

    if (isRsaPss(chosenAlgorithm)) {
      // oxlint-disable-next-line no-console
      console.warn(
        'Warning: RSA-PSS signatures may not verify correctly in older PDF readers ' +
          '(Adobe Acrobat < 2020). Consider RSASSA_PKCS1_V1_5_* for maximum compatibility.',
      );
    }

    return new AwsKmsSigner(
      client,
      options.keyId,
      chosenAlgorithm,
      options.certificate,
      options.certificateChain ?? [],
      algorithmInfo.keyType,
      algorithmInfo.signatureAlgorithm,
      algorithmInfo.digestAlgorithm,
    );
  }

  /**
   * Load a PEM-encoded certificate (and optional chain) from AWS Secrets Manager.
   *
   * The secret must contain a PEM blob. If it contains multiple certificates, the
   * first is returned as `cert` and the remainder as `chain`.
   */
  static async getCertificateFromSecretsManager(
    secretArn: string,
    options?: { region?: string; client?: SecretsManagerClient },
  ): Promise<{ cert: Uint8Array; chain?: Uint8Array[] }> {
    const clientConfig: SecretsManagerClientConfig = options?.region
      ? { region: options.region }
      : {};
    const client = options?.client ?? new SecretsManagerClient(clientConfig);

    let response;

    try {
      response = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new KmsSignerError(
        `Failed to fetch certificate from Secrets Manager (${secretArn}): ${message}`,
        error instanceof Error ? error : undefined,
      );
    }

    const payload =
      response.SecretString ??
      (response.SecretBinary ? Buffer.from(response.SecretBinary).toString('utf-8') : undefined);

    if (!payload) {
      throw new KmsSignerError(`Secrets Manager secret ${secretArn} is empty`);
    }

    const blocks = parsePem(payload);

    if (blocks.length === 0) {
      throw new KmsSignerError(
        `Secrets Manager secret ${secretArn} does not contain a PEM certificate`,
      );
    }

    const [first, ...rest] = blocks;

    return {
      cert: first.der,
      chain: rest.length > 0 ? rest.map((block) => block.der) : undefined,
    };
  }

  /**
   * Sign `data` with the KMS key.
   *
   * Hashes `data` locally via the Web Crypto API, then sends the digest to KMS
   * for signing. Returns signature bytes in the format required by @libpdf/core:
   * - RSA: PKCS#1 v1.5 or PSS signature bytes (AWS returns raw)
   * - ECDSA: DER-encoded SEQUENCE { INTEGER r, INTEGER s } (AWS returns DER)
   */
  async sign(data: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array> {
    if (algorithm !== this.digestAlgorithm) {
      throw new KmsSignerError(
        `Digest algorithm mismatch: this KMS key requires ${this.digestAlgorithm}, ` +
          `but ${algorithm} was requested`,
      );
    }

    const digestBuffer = await crypto.subtle.digest(algorithm, data);
    const digest = new Uint8Array(digestBuffer);
    const digestKey = DIGEST_KEY_MAP[algorithm];

    if (!digestKey) {
      throw new KmsSignerError(`Unsupported digest algorithm: ${algorithm}`);
    }

    let response;

    try {
      response = await this.client.send(
        new SignCommand({
          KeyId: this.keyId,
          Message: digest,
          MessageType: 'DIGEST',
          SigningAlgorithm: this.kmsSigningAlgorithm,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new KmsSignerError(
        `Failed to sign with AWS KMS key ${this.keyId}: ${message}`,
        error instanceof Error ? error : undefined,
      );
    }

    if (!response.Signature) {
      throw new KmsSignerError('AWS KMS did not return a signature');
    }

    return response.Signature;
  }
}
