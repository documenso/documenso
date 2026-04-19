import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import type { EnvironmentConfig } from "../config";

export interface ComputeProps {
  readonly config: EnvironmentConfig;
  readonly vpc: ec2.IVpc;
  readonly subnets: ec2.ISubnet[];
  readonly appSecurityGroup: ec2.SecurityGroup;
  readonly dbEndpoint: string;
  readonly dbPort: string;
  readonly dbSecret: secretsmanager.ISecret;
  readonly appConfigSecret: secretsmanager.ISecret;
  readonly databaseUrlSecret: secretsmanager.ISecret;
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
    const isInternal = config.mode === "internal";

    // -- S3 Bucket for document uploads -----------------------------------

    const uploadsBucket: s3.IBucket = isInternal
      ? s3.Bucket.fromBucketName(this, "UploadsBucket", config.uploadsBucketName)
      : new s3.Bucket(this, "UploadsBucket", {
          bucketName: cdk.Fn.join("-", [
            "documenso-uploads",
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
              allowedHeaders: ["*"],
              exposedHeaders: ["ETag"],
            },
          ],
          removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

    // -- ECS Cluster ------------------------------------------------------

    this.cluster = new ecs.Cluster(this, "Cluster", {
      vpc: props.vpc,
      clusterName: `documenso-${config.envName}`,
      enableFargateCapacityProviders: true,
    });

    // -- Log Group --------------------------------------------------------

    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName: `/documenso/${config.envName}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // -- Task Definition --------------------------------------------------

    const taskDef = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: config.fargateCpu,
      memoryLimitMiB: config.fargateMemory,
      family: `documenso-${config.envName}`,
    });

    const containerImage = isInternal
      ? ecs.ContainerImage.fromEcrRepository(props.repo!, "latest")
      : ecs.ContainerImage.fromRegistry(config.containerImage);

    const container = taskDef.addContainer("DocumensoContainer", {
      image: containerImage,
      containerName: "documenso",
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: "documenso",
      }),
      environment: {
        NODE_ENV: "production",
        PORT: "3000",
        NEXT_PUBLIC_WEBAPP_URL: `https://${config.domain}`,
        NEXT_PRIVATE_INTERNAL_WEBAPP_URL: "http://localhost:3000",
        NEXT_PUBLIC_UPLOAD_TRANSPORT: "s3",
        NEXT_PRIVATE_UPLOAD_BUCKET: uploadsBucket.bucketName,
        NEXT_PRIVATE_UPLOAD_REGION: isInternal ? config.region : cdk.Aws.REGION,
        NEXT_PRIVATE_SMTP_TRANSPORT: "smtp-auth",
        NEXT_PRIVATE_SMTP_FROM_NAME: config.appName,
        NEXT_PRIVATE_SMTP_FROM_ADDRESS: config.smtpFromAddress,
        NEXT_PRIVATE_SIGNING_TRANSPORT: "local",
        NEXT_PRIVATE_MICROSOFT_TENANT_ID: config.microsoftTenantId,
        NEXT_PRIVATE_ALLOWED_SIGNUP_DOMAINS: config.allowedSignupDomains,
        NEXT_PRIVATE_JOBS_PROVIDER: "local",
        DOCUMENSO_DISABLE_TELEMETRY: "true",
      },
      secrets: {
        NEXTAUTH_SECRET: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          "NEXTAUTH_SECRET",
        ),
        NEXT_PRIVATE_ENCRYPTION_KEY: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          "NEXT_PRIVATE_ENCRYPTION_KEY",
        ),
        NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          "NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY",
        ),
        NEXT_PRIVATE_MICROSOFT_CLIENT_ID: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          "NEXT_PRIVATE_MICROSOFT_CLIENT_ID",
        ),
        NEXT_PRIVATE_MICROSOFT_CLIENT_SECRET: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          "NEXT_PRIVATE_MICROSOFT_CLIENT_SECRET",
        ),
        NEXT_PRIVATE_SMTP_HOST: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          "NEXT_PRIVATE_SMTP_HOST",
        ),
        NEXT_PRIVATE_SMTP_PORT: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          "NEXT_PRIVATE_SMTP_PORT",
        ),
        NEXT_PRIVATE_SMTP_USERNAME: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          "NEXT_PRIVATE_SMTP_USERNAME",
        ),
        NEXT_PRIVATE_SMTP_PASSWORD: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          "NEXT_PRIVATE_SMTP_PASSWORD",
        ),
        NEXT_PRIVATE_SIGNING_PASSPHRASE: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          "NEXT_PRIVATE_SIGNING_PASSPHRASE",
        ),
        NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS: ecs.Secret.fromSecretsManager(
          props.appConfigSecret,
          "NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS",
        ),
        NEXT_PRIVATE_DATABASE_URL: ecs.Secret.fromSecretsManager(
          props.databaseUrlSecret,
          "NEXT_PRIVATE_DATABASE_URL",
        ),
        NEXT_PRIVATE_DIRECT_DATABASE_URL: ecs.Secret.fromSecretsManager(
          props.databaseUrlSecret,
          "NEXT_PRIVATE_DIRECT_DATABASE_URL",
        ),
      },
    });

    container.addPortMappings({ containerPort: 3000 });

    // -- IAM: grant execution role access to secrets ----------------------

    taskDef.executionRole?.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret:documenso/*`,
        ],
      }),
    );

    // -- IAM: grant task role access to S3 bucket -------------------------

    uploadsBucket.grantReadWrite(taskDef.taskRole);

    // -- Fargate Service --------------------------------------------------

    const service = new ecs.FargateService(this, "Service", {
      cluster: this.cluster,
      taskDefinition: taskDef,
      serviceName: `documenso-${config.envName}`,
      desiredCount: config.desiredCount,
      assignPublicIp: true,
      vpcSubnets: { subnets: props.subnets },
      securityGroups: [props.appSecurityGroup],
      capacityProviderStrategies: [
        { capacityProvider: "FARGATE", weight: 1 },
      ],
      circuitBreaker: { enable: true, rollback: true },
    });

    props.targetGroup.addTarget(service);

    // -- Outputs ----------------------------------------------------------

    new cdk.CfnOutput(this, "ClusterName", {
      value: this.cluster.clusterName,
      description: "ECS cluster name",
    });

    new cdk.CfnOutput(this, "ServiceName", {
      value: service.serviceName,
      description: "ECS service name",
    });

    new cdk.CfnOutput(this, "UploadsBucketName", {
      value: uploadsBucket.bucketName,
      description: "S3 uploads bucket",
    });
  }
}
