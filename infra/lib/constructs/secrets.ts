import * as cdk from "aws-cdk-lib";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import type { EnvironmentConfig } from "../config";

export interface SecretsProps {
  readonly config: EnvironmentConfig;
}

/**
 * Imports existing Secrets Manager secrets for application configuration.
 * Secrets are created before first deploy and imported here using full ARNs
 * (ECS can't resolve partial ARNs, and retained secrets block re-deploys
 * if CDK tries to create them).
 *
 * NOTE: After creating the secrets in AWS, update the ARN suffixes below
 * to match the actual secret ARNs (the 6-char random suffix).
 */
export class Secrets extends Construct {
  public readonly appConfig: secretsmanager.ISecret;
  public readonly databaseUrl: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: SecretsProps) {
    super(scope, id);

    // Import existing secrets by full ARN (created before first deploy)
    this.appConfig = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      "AppConfig",
      `arn:aws:secretsmanager:us-east-1:809015461931:secret:documenso/${props.config.envName}/app-config-bV5fxT`,
    );

    this.databaseUrl = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      "DatabaseUrl",
      `arn:aws:secretsmanager:us-east-1:809015461931:secret:documenso/${props.config.envName}/database-url-QVseNG`,
    );

    new cdk.CfnOutput(this, "AppConfigSecretArn", {
      value: this.appConfig.secretArn,
      description: "App config secret ARN",
    });

    new cdk.CfnOutput(this, "DatabaseUrlSecretArn", {
      value: this.databaseUrl.secretArn,
      description: "Database URL secret ARN",
    });
  }
}
