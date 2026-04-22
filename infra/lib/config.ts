/**
 * Environment configuration for the Documenso stack.
 *
 * Two deployment modes:
 *
 * 1. `internal` — CI/CD deploys where every value flows in from environment
 *    variables (set via GitHub repo variables/secrets). Used by
 *    `infra/bin/documenso.ts` and `cdk deploy`.
 * 2. `generic` — Customer-facing CloudFormation template where every value
 *    flows in from `CfnParameter` tokens at deploy time. Used by
 *    `infra/bin/cfn-synth.ts` to emit `cfn/documenso.yml`.
 *
 * Both modes yield the same `EnvironmentConfig` shape so constructs in
 * `lib/constructs/` don't need to care which mode they're running in.
 *
 * No Gnarlysoft-specific values live in this file. Internal-mode values come
 * from process.env; generic-mode values come from CfnParameters.
 */

export type DeploymentMode = 'internal' | 'generic';

/**
 * Signing backend selection.
 *
 * - `aws-kms`: self-signed cert over an AWS KMS key. Signatures verify but Adobe
 *   shows "identity not trusted". Fine for internal signing; no legal binding.
 * - `azure-kv`: Azure Key Vault Premium key with an SSL.com AATL-issued cert.
 *   Signatures verify as fully trusted in Adobe (AATL-rooted). Requires an
 *   Azure subscription, one-time $500 SSL.com attestation fee, and a CA-issued
 *   OV Document Signing cert (~$300-500/yr).
 */
export type SigningTransport = 'aws-kms' | 'azure-kv';

export interface EnvironmentConfig {
  readonly mode: DeploymentMode;

  /** Environment name used in resource naming (e.g. "dev", "prod"). */
  readonly envName: string;

  /** AWS account ID (required in internal; empty in generic — resolved at deploy). */
  readonly account: string;

  /** AWS region (required in internal; empty in generic — resolved at deploy). */
  readonly region: string;

  /** Existing VPC ID to deploy into. CFN token in generic mode. */
  readonly vpcId: string;

  /** Public subnet IDs (minimum 2 AZs). CFN tokens in generic mode. */
  readonly subnetIds: string[];

  /** Fully-qualified hostname (e.g. "sign.example.com"). */
  readonly domain: string;

  /** Route 53 hosted zone ID that owns the apex of `domain`. */
  readonly hostedZoneId: string;

  /**
   * Container image URI. Empty in internal mode (uses the Registry construct
   * with ECR repo name `containerImageRepo`); in generic mode this is the
   * full image URI (ECR or any registry).
   */
  readonly containerImage: string;

  /** ECR repo name for internal mode (empty in generic). */
  readonly containerImageRepo: string;

  // -- Database ---------------------------------------------------------

  readonly dbInstanceClass: string;
  readonly dbStorageGb: number;

  // -- Compute ----------------------------------------------------------

  readonly fargateCpu: number;
  readonly fargateMemory: number;
  readonly desiredCount: number;

  // -- App --------------------------------------------------------------

  /** Display name used in email ("From" name) and UI branding. */
  readonly appName: string;

  /** SMTP "From" address. Must be verified at your SMTP provider. */
  readonly smtpFromAddress: string;

  /** Comma-separated list of email domains allowed to sign up (empty = any). */
  readonly allowedSignupDomains: string;

  /** Microsoft/Entra tenant ID (empty = "common"). */
  readonly microsoftTenantId: string;

  // -- Secrets ----------------------------------------------------------

  /**
   * Full ARN of the pre-existing `app-config` Secrets Manager secret (internal
   * mode). In generic mode this is empty — the stack creates a fresh secret.
   */
  readonly appConfigSecretArn: string;

  /**
   * Full ARN of the pre-existing `database-url` secret (internal mode).
   * Empty in generic mode.
   */
  readonly databaseUrlSecretArn: string;

  /**
   * Name of the existing S3 uploads bucket (internal mode). Empty in generic
   * mode — the stack creates a fresh bucket.
   */
  readonly uploadsBucketName: string;

  // -- Signing ----------------------------------------------------------

  /** Which signing backend the task definition should wire up. */
  readonly signingTransport: SigningTransport;

  /**
   * Azure Key Vault URL (e.g. `https://my-vault.vault.azure.net`). Required
   * when `signingTransport === "azure-kv"`; ignored otherwise.
   */
  readonly azureKvUrl: string;

  /** Key name inside the Azure Key Vault. Required for `azure-kv`. */
  readonly azureKvKeyName: string;

  /** Optional Azure KV key version. Blank = use latest. */
  readonly azureKvKeyVersion: string;
}

// ---------------------------------------------------------------------------
// Internal mode config loader
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it via GitHub repo variables/secrets (see .github/workflows/deploy-aws.yml) ` +
        `or export it locally before running cdk.`,
    );
  }
  return value;
}

function optionalEnv(name: string, fallback: string = ''): string {
  return process.env[name] ?? fallback;
}

const SIZING: Record<
  string,
  Pick<
    EnvironmentConfig,
    'dbInstanceClass' | 'dbStorageGb' | 'fargateCpu' | 'fargateMemory' | 'desiredCount'
  >
> = {
  dev: {
    dbInstanceClass: 't4g.micro',
    dbStorageGb: 20,
    fargateCpu: 512,
    fargateMemory: 1024,
    desiredCount: 1,
  },
  prod: {
    dbInstanceClass: 't4g.small',
    dbStorageGb: 50,
    fargateCpu: 1024,
    fargateMemory: 2048,
    desiredCount: 2,
  },
};

/**
 * Build the internal-mode configuration from environment variables. Throws
 * if any required variable is missing.
 */
export function getInternalConfig(envName: string): EnvironmentConfig {
  const sizing = SIZING[envName];
  if (!sizing) {
    throw new Error(`Unknown environment: ${envName}. Valid: ${Object.keys(SIZING).join(', ')}`);
  }

  return {
    mode: 'internal',
    envName,
    account: requireEnv('AWS_ACCOUNT_ID'),
    region: requireEnv('AWS_REGION'),
    vpcId: requireEnv('AWS_VPC_ID'),
    subnetIds: requireEnv('AWS_SUBNET_IDS')
      .split(',')
      .map((s) => s.trim()),
    domain: requireEnv('DOMAIN'),
    hostedZoneId: requireEnv('HOSTED_ZONE_ID'),
    containerImage: '',
    containerImageRepo: requireEnv('ECR_REPOSITORY'),
    appName: requireEnv('APP_NAME'),
    smtpFromAddress: requireEnv('SMTP_FROM_ADDRESS'),
    allowedSignupDomains: optionalEnv('ALLOWED_SIGNUP_DOMAINS'),
    microsoftTenantId: optionalEnv('MICROSOFT_TENANT_ID'),
    appConfigSecretArn: requireEnv('APP_CONFIG_SECRET_ARN'),
    databaseUrlSecretArn: requireEnv('DATABASE_URL_SECRET_ARN'),
    uploadsBucketName: optionalEnv('UPLOADS_BUCKET_NAME', `documenso-uploads-${envName}`),
    signingTransport: optionalEnv('SIGNING_TRANSPORT', 'aws-kms') as SigningTransport,
    azureKvUrl: optionalEnv('AZURE_KV_URL'),
    azureKvKeyName: optionalEnv('AZURE_KV_KEY_NAME'),
    azureKvKeyVersion: optionalEnv('AZURE_KV_KEY_VERSION'),
    ...sizing,
  };
}
