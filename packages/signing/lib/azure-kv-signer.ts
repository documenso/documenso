import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import { CertificateClient } from '@azure/keyvault-certificates';
import { CryptographyClient, KeyClient, type KnownSignatureAlgorithms } from '@azure/keyvault-keys';
import { SecretClient } from '@azure/keyvault-secrets';
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
 * Map an Azure Key Vault signature algorithm to @libpdf/core's algorithm types.
 *
 * Azure advertises signature algorithms as short strings (RS256, PS256, ES256, etc.).
 * An RSA key can sign with any of RS* (PKCS#1 v1.5) or PS* (PSS); an EC key uses ES*.
 */
const AZURE_ALGORITHM_MAP: Record<string, AlgorithmInfo> = {
  RS256: {
    keyType: 'RSA',
    signatureAlgorithm: 'RSASSA-PKCS1-v1_5',
    digestAlgorithm: 'SHA-256',
  },
  RS384: {
    keyType: 'RSA',
    signatureAlgorithm: 'RSASSA-PKCS1-v1_5',
    digestAlgorithm: 'SHA-384',
  },
  RS512: {
    keyType: 'RSA',
    signatureAlgorithm: 'RSASSA-PKCS1-v1_5',
    digestAlgorithm: 'SHA-512',
  },
  PS256: {
    keyType: 'RSA',
    signatureAlgorithm: 'RSA-PSS',
    digestAlgorithm: 'SHA-256',
  },
  PS384: {
    keyType: 'RSA',
    signatureAlgorithm: 'RSA-PSS',
    digestAlgorithm: 'SHA-384',
  },
  PS512: {
    keyType: 'RSA',
    signatureAlgorithm: 'RSA-PSS',
    digestAlgorithm: 'SHA-512',
  },
  ES256: {
    keyType: 'EC',
    signatureAlgorithm: 'ECDSA',
    digestAlgorithm: 'SHA-256',
  },
  ES384: {
    keyType: 'EC',
    signatureAlgorithm: 'ECDSA',
    digestAlgorithm: 'SHA-384',
  },
  ES512: {
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

const mapAzureAlgorithm = (algorithm: string): AlgorithmInfo => {
  const info = AZURE_ALGORITHM_MAP[algorithm];

  if (!info) {
    throw new KmsSignerError(`Unsupported Azure Key Vault signing algorithm: ${algorithm}`);
  }

  return info;
};

const isRsaPss = (algorithm: string): boolean => algorithm.startsWith('PS');
const isEcdsa = (algorithm: string): boolean => algorithm.startsWith('ES');

/**
 * Convert an Azure-format ECDSA signature (R||S concatenation) to the DER-encoded
 * SEQUENCE { INTEGER r, INTEGER s } format expected by @libpdf/core.
 *
 * Azure returns the signature as fixed-width R || S (e.g. 64 bytes for P-256);
 * @libpdf/core (matching AWS KMS, PKCS#11, etc.) expects ASN.1 DER.
 */
const ecdsaRawToDer = (raw: Uint8Array): Uint8Array => {
  if (raw.length % 2 !== 0) {
    throw new KmsSignerError(`ECDSA signature has odd length (${raw.length}), expected R||S`);
  }

  const half = raw.length / 2;
  const r = raw.slice(0, half);
  const s = raw.slice(half);

  const encodeInteger = (bytes: Uint8Array): Uint8Array => {
    let start = 0;

    while (start < bytes.length - 1 && bytes[start] === 0) {
      start += 1;
    }

    const trimmed = bytes.slice(start);
    const needsPad = (trimmed[0] & 0x80) !== 0;
    const body = needsPad ? new Uint8Array([0, ...trimmed]) : trimmed;

    return new Uint8Array([0x02, body.length, ...body]);
  };

  const rEncoded = encodeInteger(r);
  const sEncoded = encodeInteger(s);
  const content = new Uint8Array([...rEncoded, ...sEncoded]);

  return new Uint8Array([0x30, content.length, ...content]);
};

type AzureKvCredentials = {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
};

const buildCredential = (creds: AzureKvCredentials) => {
  if (creds.tenantId && creds.clientId && creds.clientSecret) {
    return new ClientSecretCredential(creds.tenantId, creds.clientId, creds.clientSecret);
  }

  return new DefaultAzureCredential();
};

type AzureKvSignerCreateOptions = {
  /** Full vault URL, e.g. `https://my-vault.vault.azure.net`. */
  vaultUrl: string;
  /** Key name inside the vault. */
  keyName: string;
  /** Optional key version. Omit to use the latest version. */
  keyVersion?: string;
  /** Override the signing algorithm; defaults to `RS256` for RSA keys. */
  signingAlgorithm?: KnownSignatureAlgorithms | string;
  /** DER-encoded X.509 signing certificate. */
  certificate: Uint8Array;
  /** Optional DER-encoded cert chain [intermediate, ..., root]. */
  certificateChain?: Uint8Array[];
  /** Azure SP credentials. If any are omitted, falls back to `DefaultAzureCredential`. */
  credentials?: AzureKvCredentials;
};

/**
 * Signer that uses Azure Key Vault for asymmetric signing operations.
 *
 * Supports RSA and ECDSA keys stored in Azure Key Vault Premium or Managed HSM.
 * The private key never leaves the vault — only the digest is sent for signing.
 *
 * Auth resolves through `DefaultAzureCredential` unless a service principal
 * (tenant/client/secret) is passed explicitly, in which case `ClientSecretCredential`
 * is used instead. For PaaS deployments (ECS Fargate, etc.), pass the SP credentials
 * via the env vars read in `transports/azure-kv.ts`.
 *
 * @example
 * ```typescript
 * const signer = await AzureKvSigner.create({
 *   vaultUrl: 'https://my-vault.vault.azure.net',
 *   keyName: 'documenso-signing-prod',
 *   certificate: certDer,
 *   credentials: { tenantId, clientId, clientSecret },
 * });
 * ```
 */
export class AzureKvSigner implements Signer {
  readonly certificate: Uint8Array;
  readonly certificateChain: Uint8Array[];
  readonly keyType: KeyType;
  readonly signatureAlgorithm: SignatureAlgorithm;
  readonly digestAlgorithm: DigestAlgorithm;
  readonly vaultUrl: string;
  readonly keyName: string;
  readonly keyVersion: string | undefined;
  readonly azureSigningAlgorithm: string;

  private readonly cryptoClient: CryptographyClient;

  private constructor(
    cryptoClient: CryptographyClient,
    vaultUrl: string,
    keyName: string,
    keyVersion: string | undefined,
    azureSigningAlgorithm: string,
    certificate: Uint8Array,
    certificateChain: Uint8Array[],
    keyType: KeyType,
    signatureAlgorithm: SignatureAlgorithm,
    digestAlgorithm: DigestAlgorithm,
  ) {
    this.cryptoClient = cryptoClient;
    this.vaultUrl = vaultUrl;
    this.keyName = keyName;
    this.keyVersion = keyVersion;
    this.azureSigningAlgorithm = azureSigningAlgorithm;
    this.certificate = certificate;
    this.certificateChain = certificateChain;
    this.keyType = keyType;
    this.signatureAlgorithm = signatureAlgorithm;
    this.digestAlgorithm = digestAlgorithm;
  }

  /**
   * Create an `AzureKvSigner` from a key reference and signing certificate.
   *
   * Fetches the key to determine its type (RSA vs EC), then defaults the
   * signing algorithm to `RS256` (RSA) or `ES256` (EC) unless overridden.
   */
  static async create(options: AzureKvSignerCreateOptions): Promise<AzureKvSigner> {
    const credential = buildCredential(options.credentials ?? {});

    const keyClient = new KeyClient(options.vaultUrl, credential);

    let key;

    try {
      key = await keyClient.getKey(options.keyName, { version: options.keyVersion });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new KmsSignerError(
        `Failed to fetch Azure Key Vault key ${options.keyName} from ${options.vaultUrl}: ${message}`,
        error instanceof Error ? error : undefined,
      );
    }

    const keyType = key.keyType ?? key.key?.kty ?? '';
    const isRsaKey = keyType === 'RSA' || keyType === 'RSA-HSM';
    const isEcKey = keyType === 'EC' || keyType === 'EC-HSM';

    if (!isRsaKey && !isEcKey) {
      throw new KmsSignerError(
        `Azure Key Vault key ${options.keyName} has unsupported type ${keyType}. Expected RSA or EC.`,
      );
    }

    const defaultAlgorithm = isRsaKey ? 'RS256' : 'ES256';
    const chosenAlgorithm = options.signingAlgorithm ?? defaultAlgorithm;

    const algorithmInfo = mapAzureAlgorithm(chosenAlgorithm);

    if (isRsaPss(chosenAlgorithm)) {
      // oxlint-disable-next-line no-console
      console.warn(
        'Warning: RSA-PSS signatures may not verify correctly in older PDF readers ' +
          '(Adobe Acrobat < 2020). Consider RS256/RS384/RS512 for maximum compatibility.',
      );
    }

    const cryptoClient = new CryptographyClient(key, credential);

    return new AzureKvSigner(
      cryptoClient,
      options.vaultUrl,
      options.keyName,
      options.keyVersion,
      chosenAlgorithm,
      options.certificate,
      options.certificateChain ?? [],
      algorithmInfo.keyType,
      algorithmInfo.signatureAlgorithm,
      algorithmInfo.digestAlgorithm,
    );
  }

  /**
   * Load a PEM-encoded certificate (and optional chain) from Azure Key Vault.
   *
   * Tries the Certificates API first (the natural home for CA-issued certs
   * after a CSR merge), falls back to the Secrets API (for manually-stored
   * base64 PEM blobs).
   */
  static async getCertificateFromVault(
    vaultUrl: string,
    certName: string,
    options?: { credentials?: AzureKvCredentials; secretName?: string },
  ): Promise<{ cert: Uint8Array; chain?: Uint8Array[] }> {
    const credential = buildCredential(options?.credentials ?? {});

    const certClient = new CertificateClient(vaultUrl, credential);

    try {
      const cert = await certClient.getCertificate(certName);

      if (cert.cer) {
        return { cert: new Uint8Array(cert.cer) };
      }
    } catch (error) {
      // Fall through to Secrets API.
    }

    const secretClient = new SecretClient(vaultUrl, credential);
    const secretName = options?.secretName ?? certName;

    let secret;

    try {
      secret = await secretClient.getSecret(secretName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new KmsSignerError(
        `Failed to fetch certificate from Azure Key Vault (${vaultUrl}, ${certName}): ${message}`,
        error instanceof Error ? error : undefined,
      );
    }

    if (!secret.value) {
      throw new KmsSignerError(`Azure Key Vault secret ${secretName} is empty`);
    }

    const blocks = parsePem(secret.value);

    if (blocks.length === 0) {
      throw new KmsSignerError(
        `Azure Key Vault secret ${secretName} does not contain a PEM certificate`,
      );
    }

    const [first, ...rest] = blocks;

    return {
      cert: first.der,
      chain: rest.length > 0 ? rest.map((block) => block.der) : undefined,
    };
  }

  /**
   * Sign `data` with the Azure Key Vault key.
   *
   * Hashes `data` locally via Web Crypto, then sends the digest to Key Vault.
   * For ECDSA keys, converts Azure's R||S signature format to DER before returning.
   */
  async sign(data: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array> {
    if (algorithm !== this.digestAlgorithm) {
      throw new KmsSignerError(
        `Digest algorithm mismatch: this Key Vault key requires ${this.digestAlgorithm}, ` +
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
      response = await this.cryptoClient.sign(
        this.azureSigningAlgorithm as KnownSignatureAlgorithms,
        digest,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new KmsSignerError(
        `Failed to sign with Azure Key Vault key ${this.keyName}: ${message}`,
        error instanceof Error ? error : undefined,
      );
    }

    if (!response.result) {
      throw new KmsSignerError('Azure Key Vault did not return a signature');
    }

    const signature = new Uint8Array(response.result);

    if (isEcdsa(this.azureSigningAlgorithm)) {
      return ecdsaRawToDer(signature);
    }

    return signature;
  }
}
