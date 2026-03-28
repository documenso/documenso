/**
 * Environment-specific configuration for the Documenso stack.
 *
 * Usage:
 *   const config = getConfig('dev');
 *   new DocumensoStack(app, `Documenso-${config.envName}`, { config });
 */

export interface EnvironmentConfig {
  /** Environment name used in resource naming. */
  readonly envName: string;

  /** AWS account ID. */
  readonly account: string;

  /** AWS region. */
  readonly region: string;

  /** Existing VPC ID to deploy into. */
  readonly vpcId: string;

  /** Public subnet IDs within the VPC. */
  readonly subnetIds: string[];

  /** Domain name for the Documenso instance. */
  readonly domain: string;

  /** Route 53 hosted zone ID for the domain. */
  readonly hostedZoneId: string;

  // -- Database ---------------------------------------------------------

  /** RDS instance class. */
  readonly dbInstanceClass: string;

  /** Storage in GB. */
  readonly dbStorageGb: number;

  // -- Compute ----------------------------------------------------------

  /** Fargate CPU (in milli-vCPU: 256 = 0.25 vCPU). */
  readonly fargateCpu: number;

  /** Fargate memory (in MiB). */
  readonly fargateMemory: number;

  /** Desired task count. */
  readonly desiredCount: number;
}

const SHARED = {
  account: "809015461931",
  region: "us-east-1",
  vpcId: "vpc-889621f2",
  subnetIds: ["subnet-065945a74d9f344b8", "subnet-439ff96d"],
  domain: "sign.gnarlysoft.com",
  hostedZoneId: "Z01372345YL6LKC37MDH",
};

const configs: Record<string, EnvironmentConfig> = {
  dev: {
    ...SHARED,
    envName: "dev",

    dbInstanceClass: "t4g.micro",
    dbStorageGb: 20,

    fargateCpu: 512,
    fargateMemory: 1024,
    desiredCount: 1,
  },

  prod: {
    ...SHARED,
    envName: "prod",

    dbInstanceClass: "t4g.small",
    dbStorageGb: 50,

    fargateCpu: 1024,
    fargateMemory: 2048,
    desiredCount: 2,
  },
};

/**
 * Return the configuration for the given environment name.
 *
 * @param env - environment key (e.g. "dev", "prod").
 * @returns the matching environment config.
 * @throws if the environment name is not recognised.
 */
export function getConfig(env: string): EnvironmentConfig {
  const config = configs[env];
  if (!config) {
    throw new Error(
      `Unknown environment: ${env}. Valid: ${Object.keys(configs).join(", ")}`,
    );
  }
  return config;
}
