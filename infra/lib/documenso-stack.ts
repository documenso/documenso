import * as cdk from 'aws-cdk-lib';
import type { Construct } from 'constructs';

import type { EnvironmentConfig } from './config';
import { Compute } from './constructs/compute';
import { Database } from './constructs/database';
import { Networking } from './constructs/networking';
import { Registry } from './constructs/registry';
import { Secrets } from './constructs/secrets';
import { SigningKms } from './constructs/signing-kms';

export interface DocumensoStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
}

/**
 * Main CDK stack for the Documenso deployment on ECS Fargate.
 */
export class DocumensoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DocumensoStackProps) {
    super(scope, id, props);

    const { config } = props;

    // -- Tag everything ---------------------------------------------------
    cdk.Tags.of(this).add('project', 'documenso');
    cdk.Tags.of(this).add('environment', config.envName);

    // -- Networking (SGs, ALB, TLS, DNS in existing VPC) ------------------
    const networking = new Networking(this, 'Networking', { config });

    // -- Database (RDS PostgreSQL 16) -------------------------------------
    const database = new Database(this, 'Database', {
      config,
      vpc: networking.vpc,
      subnets: networking.subnets,
      dbSecurityGroup: networking.dbSecurityGroup,
    });

    // -- Container Registry (ECR) -----------------------------------------
    const registry = new Registry(this, 'Registry');

    // -- Secrets Manager (app config) -------------------------------------
    const secrets = new Secrets(this, 'Secrets', { config });

    // -- KMS signing key (for PDF signatures) -----------------------------
    const signingKms = new SigningKms(this, 'SigningKms', { config });

    // -- Compute (ECS Fargate service + S3 bucket) ------------------------
    new Compute(this, 'Compute', {
      config,
      vpc: networking.vpc,
      subnets: networking.subnets,
      appSecurityGroup: networking.appSecurityGroup,
      dbEndpoint: database.dbEndpoint,
      dbPort: database.dbPort,
      dbSecret: database.dbSecret,
      dbInstance: database.instance,
      appConfigSecret: secrets.appConfig,
      databaseUrlSecret: secrets.databaseUrl,
      signingKey: signingKms.key,
      repo: registry.repo,
      targetGroup: networking.appTargetGroup,
    });
  }
}
