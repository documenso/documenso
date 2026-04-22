import * as cdk from 'aws-cdk-lib';
import type * as ec2 from 'aws-cdk-lib/aws-ec2';
import type * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import type * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import type * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import type * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

import type { EnvironmentConfig } from '../config';

export interface ComputeProps {
  readonly config: EnvironmentConfig;
  readonly vpc: ec2.IVpc;
  readonly subnets: ec2.ISubnet[];
  readonly appSecurityGroup: ec2.SecurityGroup;
  readonly dbEndpoint: string;
  readonly dbPort: string;
  readonly dbSecret: secretsmanager.ISecret;
  readonly dbInstance?: rds.IDatabaseInstance;
  readonly appConfigSecret: secretsmanager.ISecret;
  readonly databaseUrlSecret: secretsmanager.ISecret;
  readonly signingKey: kms.IKey;
  /** Used only in internal mode (when pulling from our ECR repo). */
  readonly repo?: ecr.IRepository;
  readonly targetGroup: elbv2.ApplicationTargetGroup;
}

/**
 * ECS Fargate cluster with the Documenso service, an S3 bucket for document
 * uploads (imported by name in internal mode, created in generic mode), and
 * the IAM permissions needed to pull container images and read secrets.
 */
export class Compute extends Construct {
  public readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props: ComputeProps) {
    super(scope, id);

    const { config } = props;
    const isInternal = config.mode === 'internal';

    // -- S3 Bucket for document uploads -----------------------------------

    const uploadsBucket: s3.IBucket = isInternal
      ? s3.Bucket.fromBucketName(this, 'UploadsBucket', config.uploadsBucketName)
      : new s3.Bucket(this, 'UploadsBucket', {
          bucketName: cdk.Fn.join('-', [
            'documenso-uploads',
            cdk.Aws.ACCOUNT_ID,
            cdk.Aws.REGION,
            cdk.Aws.STACK_NAME,
          ]),
          encryption: s3.BucketEncryption.S3_MANAGED,
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          cors: [
            {
              allowedMethods: [
                s3.HttpMethods.GET,
                s3.HttpMethods.PUT,
                s3.HttpMethods.POST,
                s3.HttpMethods.DELETE,
              ],
              allowedOrigins: [`https://${config.domain}`],
              allowedHeaders: ['*'],
              exposedHeaders: ['ETag'],
            },
          ],
          removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

    // -- ECS Cluster ------------------------------------------------------

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      clusterName: `documenso-${config.envName}`,
      enableFargateCapacityProviders: true,
    });

    // -- Log Group --------------------------------------------------------

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/documenso/${config.envName}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // -- Task Definition --------------------------------------------------

    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: config.fargateCpu,
      memoryLimitMiB: config.fargateMemory,
      family: `documenso-${config.envName}`,
    });

    const containerImage = isInternal
      ? ecs.ContainerImage.fromEcrRepository(props.repo!, 'latest')
      : ecs.ContainerImage.fromRegistry(config.containerImage);

    // -- Signing secrets: Azure entries are only wired into the task def when
    // the active transport needs them. In internal mode we branch on the string
    // `config.signingTransport`; in generic mode the azure-kv placeholder keys
    // always exist in the freshly-created secret, so including them is safe.
    const includeAzureKvSecrets = !isInternal || config.signingTransport === 'azure-kv';
    const includeAwsKmsSecrets = !isInternal || config.signingTransport === 'aws-kms';

    const azureKvSecrets: Record<string, ecs.Secret> = includeAzureKvSecrets
      ? {
          NEXT_PRIVATE_SIGNING_AZURE_KV_TENANT_ID: ecs.Secret.fromSecretsManager(
            props.appConfigSecret,
            'NEXT_PRIVATE_SIGNING_AZURE_KV_TENANT_ID',
          ),
          NEXT_PRIVATE_SIGNING_AZURE_KV_CLIENT_ID: ecs.Secret.fromSecretsManager(
            props.appConfigSecret,
            'NEXT_PRIVATE_SIGNING_AZURE_KV_CLIENT_ID',
          ),
          NEXT_PRIVATE_SIGNING_AZURE_KV_CLIENT_SECRET: ecs.Secret.fromSecretsManager(
            props.appConfigSecret,
            'NEXT_PRIVATE_SIGNING_AZURE_KV_CLIENT_SECRET',
          ),
          NEXT_PRIVATE_SIGNING_AZURE_KV_PUBLIC_CRT_FILE_CONTENTS: ecs.Secret.fromSecretsManager(
            props.appConfigSecret,
            'NEXT_PRIVATE_SIGNING_AZURE_KV_PUBLIC_CRT_FILE_CONTENTS',
          ),
          NEXT_PRIVATE_SIGNING_AZURE_KV_CERT_CHAIN_CONTENTS: ecs.Secret.fromSecretsManager(
            props.appConfigSecret,
            'NEXT_PRIVATE_SIGNING_AZURE_KV_CERT_CHAIN_CONTENTS',
          ),
        }
      : {};

    const awsKmsSecrets: Record<string, ecs.Secret> = includeAwsKmsSecrets
      ? {
          NEXT_PRIVATE_SIGNING_AWS_KMS_PUBLIC_CRT_FILE_CONTENTS: ecs.Secret.fromSecretsManager(
            props.appConfigSecret,
            'NEXT_PRIVATE_SIGNING_AWS_KMS_PUBLIC_CRT_FILE_CONTENTS',
          ),
        }
      : {};

    const container = taskDef.addContainer('DocumensoContainer', {
      image: containerImage,
      containerName: 'documenso',
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: 'documenso',
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        NEXT_PUBLIC_WEBAPP_URL: `https://${config.domain}`,
        NEXT_PRIVATE_INTERNAL_WEBAPP_URL: 'http://localhost:3000',
        NEXT_PUBLIC_UPLOAD_TRANSPORT: 's3',
        NEXT_PRIVATE_UPLOAD_BUCKET: uploadsBucket.bucketName,
        NEXT_PRIVATE_UPLOAD_REGION: isInternal ? config.region : cdk.Aws.REGION,
        NEXT_PRIVATE_SMTP_TRANSPORT: 'smtp-auth',
        NEXT_PRIVATE_SMTP_FROM_NAME: config.appName,
        NEXT_PRIVATE_SMTP_FROM_ADDRESS: config.smtpFromAddress,
        // Signing — both transports' env vars are always present so the task
        // def is stable across transport switches. The app picks based on
        // NEXT_PRIVATE_SIGNING_TRANSPORT and ignores the other set.
        NEXT_PRIVATE_SIGNING_TRANSPORT: config.signingTransport,
        NEXT_PRIVATE_SIGNING_AWS_KMS_KEY_ID: props.signingKey.keyArn,
        NEXT_PRIVATE_SIGNING_AWS_KMS_REGION: isInternal ? config.region : cdk.Aws.REGION,
        NEXT_PRIVATE_SIGNING_AZURE_KV_URL: config.azureKvUrl,
        NEXT_PRIVATE_SIGNING_AZURE_KV_KEY_NAME: config.azureKvKeyName,
        NEXT_PRIVATE_SIGNING_AZURE_KV_KEY_VERSION: config.azureKvKeyVersion,
        NEXT_PRIVATE_MICROSOFT_TENANT_ID: config.microsoftTenantId,
        NEXT_PRIVATE_ALLOWED_SIGNUP_DOMAINS: config.allowedSignupDomains,
        NEXT_PRIVATE_JOBS_PROVIDER: 'local',
        DOCUMENSO_DISABLE_TELEMETRY: 'true',
      },
      secrets: {
        NEXTAUTH_SECRET: ecs.Secret.fromSecretsManager(props.appConfigSecret, 'NEXTAUTH_SECRET'),
        NEXT_PRIVATE_ENCRYPTION_KEY: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          'NEXT_PRIVATE_ENCRYPTION_KEY',
        ),
        NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          'NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY',
        ),
        NEXT_PRIVATE_MICROSOFT_CLIENT_ID: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          'NEXT_PRIVATE_MICROSOFT_CLIENT_ID',
        ),
        NEXT_PRIVATE_MICROSOFT_CLIENT_SECRET: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          'NEXT_PRIVATE_MICROSOFT_CLIENT_SECRET',
        ),
        NEXT_PRIVATE_SMTP_HOST: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          'NEXT_PRIVATE_SMTP_HOST',
        ),
        NEXT_PRIVATE_SMTP_PORT: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          'NEXT_PRIVATE_SMTP_PORT',
        ),
        NEXT_PRIVATE_SMTP_USERNAME: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          'NEXT_PRIVATE_SMTP_USERNAME',
        ),
        NEXT_PRIVATE_SMTP_PASSWORD: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          'NEXT_PRIVATE_SMTP_PASSWORD',
        ),
        ...awsKmsSecrets,
        ...azureKvSecrets,
        NEXT_PRIVATE_DATABASE_URL: ecs.Secret.fromSecretsManager(
          props.databaseUrlSecret,
          'NEXT_PRIVATE_DATABASE_URL',
        ),
        NEXT_PRIVATE_DIRECT_DATABASE_URL: ecs.Secret.fromSecretsManager(
          props.databaseUrlSecret,
          'NEXT_PRIVATE_DIRECT_DATABASE_URL',
        ),
      },
    });

    container.addPortMappings({ containerPort: 3000 });

    // -- IAM: grant execution role access to secrets ----------------------

    taskDef.executionRole?.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret:documenso/*`,
        ],
      }),
    );

    // -- IAM: grant execution role ECR pull + CloudWatch Logs permissions --
    // CDK only auto-adds these when the image comes from an ecr.Repository
    // reference. In generic mode we use ContainerImage.fromRegistry(string),
    // so CDK doesn't know it's ECR and skips the grant. Attach the managed
    // policy explicitly so the task execution role can pull from any ECR
    // (or public registry) and write to CloudWatch Logs.
    taskDef.executionRole?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
    );

    // -- IAM: grant task role access to S3 bucket -------------------------

    uploadsBucket.grantReadWrite(taskDef.taskRole);

    // -- IAM: grant task role access to the KMS signing key ---------------

    props.signingKey.grant(taskDef.taskRole, 'kms:Sign', 'kms:GetPublicKey');

    // -- Fargate Service --------------------------------------------------

    const service = new ecs.FargateService(this, 'Service', {
      cluster: this.cluster,
      taskDefinition: taskDef,
      serviceName: `documenso-${config.envName}`,
      desiredCount: config.desiredCount,
      assignPublicIp: true,
      vpcSubnets: { subnets: props.subnets },
      securityGroups: [props.appSecurityGroup],
      capacityProviderStrategies: [{ capacityProvider: 'FARGATE', weight: 1 }],
      // Circuit breaker intentionally disabled. On first deploy the app-config
      // secret still has placeholder values (the skill populates them in parallel
      // with stack creation), so tasks will restart-loop briefly until populated.
      // With circuit breaker + rollback enabled, the service resource would fail
      // create before the skill can finish the dance. Deployers who want circuit
      // breaker enabled on subsequent rollouts can flip this post-deploy.
      circuitBreaker: { enable: false, rollback: false },
    });

    // Ensure the service isn't created until RDS is ready. Otherwise ECS tries
    // to launch tasks that fail their DB connection before RDS finishes
    // provisioning, wasting 5+ minutes of restart loops per stack create.
    if (props.dbInstance) {
      service.node.addDependency(props.dbInstance);
    }

    props.targetGroup.addTarget(service);

    // -- Outputs ----------------------------------------------------------

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS cluster name',
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: service.serviceName,
      description: 'ECS service name',
    });

    new cdk.CfnOutput(this, 'UploadsBucketName', {
      value: uploadsBucket.bucketName,
      description: 'S3 uploads bucket',
    });
  }
}
