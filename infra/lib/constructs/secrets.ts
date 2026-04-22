import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

import type { EnvironmentConfig } from '../config';

export interface SecretsProps {
  readonly config: EnvironmentConfig;
}

/**
 * Application secrets management.
 *
 * - `internal` mode: imports pre-existing secrets by full ARN (the secrets are
 *   created out-of-band before first deploy). Full ARNs are required because
 *   ECS can't resolve partial ARNs.
 * - `generic` mode: creates fresh Secrets Manager entries. NEXTAUTH_SECRET and
 *   the two encryption keys are auto-generated; SSO/SMTP/signing values are
 *   populated out-of-band after deploy by updating the secret JSON.
 */
export class Secrets extends Construct {
  public readonly appConfig: secretsmanager.ISecret;
  public readonly databaseUrl: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: SecretsProps) {
    super(scope, id);

    const { config } = props;

    if (config.mode === 'internal') {
      this.appConfig = secretsmanager.Secret.fromSecretCompleteArn(
        this,
        'AppConfig',
        config.appConfigSecretArn,
      );

      this.databaseUrl = secretsmanager.Secret.fromSecretCompleteArn(
        this,
        'DatabaseUrl',
        config.databaseUrlSecretArn,
      );
    } else {
      this.appConfig = new secretsmanager.Secret(this, 'AppConfig', {
        secretName: `documenso/${config.envName}/app-config`,
        description:
          'Documenso app secrets (NEXTAUTH_SECRET, encryption keys, SSO, SMTP, signing cert). ' +
          'Auto-generated placeholder values — update after deploy.',
        generateSecretString: {
          secretStringTemplate: JSON.stringify({
            NEXT_PRIVATE_MICROSOFT_CLIENT_ID: '',
            NEXT_PRIVATE_MICROSOFT_CLIENT_SECRET: '',
            NEXT_PRIVATE_SMTP_HOST: '',
            NEXT_PRIVATE_SMTP_PORT: '587',
            NEXT_PRIVATE_SMTP_USERNAME: '',
            NEXT_PRIVATE_SMTP_PASSWORD: '',
            NEXT_PRIVATE_SIGNING_AWS_KMS_PUBLIC_CRT_FILE_CONTENTS: '',
            NEXT_PRIVATE_SIGNING_AZURE_KV_TENANT_ID: '',
            NEXT_PRIVATE_SIGNING_AZURE_KV_CLIENT_ID: '',
            NEXT_PRIVATE_SIGNING_AZURE_KV_CLIENT_SECRET: '',
            NEXT_PRIVATE_SIGNING_AZURE_KV_PUBLIC_CRT_FILE_CONTENTS: '',
            NEXT_PRIVATE_SIGNING_AZURE_KV_CERT_CHAIN_CONTENTS: '',
            NEXT_PRIVATE_ENCRYPTION_KEY: '',
            NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY: '',
          }),
          generateStringKey: 'NEXTAUTH_SECRET',
          excludePunctuation: true,
          passwordLength: 64,
        },
      });

      this.databaseUrl = new secretsmanager.Secret(this, 'DatabaseUrl', {
        secretName: `documenso/${config.envName}/database-url`,
        description:
          'Documenso DATABASE_URL secret — populated by the skill after RDS endpoint is known.',
        secretStringValue: cdk.SecretValue.unsafePlainText(
          JSON.stringify({
            NEXT_PRIVATE_DATABASE_URL: 'postgresql://placeholder',
            NEXT_PRIVATE_DIRECT_DATABASE_URL: 'postgresql://placeholder',
          }),
        ),
      });
    }

    new cdk.CfnOutput(this, 'AppConfigSecretArn', {
      value: this.appConfig.secretArn,
      description: 'App config secret ARN',
    });

    new cdk.CfnOutput(this, 'DatabaseUrlSecretArn', {
      value: this.databaseUrl.secretArn,
      description: 'Database URL secret ARN',
    });
  }
}
