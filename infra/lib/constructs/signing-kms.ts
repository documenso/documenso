import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

import type { EnvironmentConfig } from '../config';

export interface SigningKmsProps {
  readonly config: EnvironmentConfig;
}

/**
 * KMS asymmetric signing key used by Documenso to sign PDFs.
 *
 * Created once per deploy and managed by CloudFormation — no drift, no
 * manual IAM wiring. The cert that carries this key's public half is
 * supplied out-of-band (self-signed during onboarding; AATL-issued for
 * production) and stored in the app-config secret as a base64 PEM.
 *
 * - Key spec: RSA 2048. Widest AATL CA compatibility + strong Adobe support.
 * - Usage: SIGN_VERIFY. Encryption keys have a different spec.
 * - Removal policy: RETAIN. Protects against accidental stack delete
 *   losing the private key — which would invalidate every signature ever
 *   made with this key and orphan every issued AATL cert.
 */
export class SigningKms extends Construct {
  public readonly key: kms.Key;

  constructor(scope: Construct, id: string, props: SigningKmsProps) {
    super(scope, id);

    const { config } = props;

    this.key = new kms.Key(this, 'Key', {
      alias: `documenso-signing-${config.envName}`,
      description: `Documenso PDF signing key (${config.envName}). Used server-side via NEXT_PRIVATE_SIGNING_TRANSPORT=aws-kms.`,
      keySpec: kms.KeySpec.RSA_2048,
      keyUsage: kms.KeyUsage.SIGN_VERIFY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cdk.CfnOutput(this, 'SigningKeyArn', {
      value: this.key.keyArn,
      description:
        'AWS KMS signing key ARN. Generate a cert against this key and store the PEM in the app-config secret.',
    });

    new cdk.CfnOutput(this, 'SigningKeyAlias', {
      value: `alias/documenso-signing-${config.envName}`,
      description: 'Friendly alias for the signing key (equivalent to the ARN above).',
    });
  }
}
