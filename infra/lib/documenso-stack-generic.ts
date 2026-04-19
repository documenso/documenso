import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import type { EnvironmentConfig } from "./config";
import { Networking } from "./constructs/networking";
import { Database } from "./constructs/database";
import { Secrets } from "./constructs/secrets";
import { Compute } from "./constructs/compute";

/**
 * Customer-facing CloudFormation stack.
 *
 * Every customer-specific value (VPC, subnets, domain, SSO credentials,
 * container image URI, sizing, etc.) flows in as a CfnParameter so the same
 * generated template can be deployed into any AWS account without editing.
 */
export class GenericDocumensoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -- Environment ------------------------------------------------------

    const envName = new cdk.CfnParameter(this, "EnvName", {
      type: "String",
      default: "prod",
      description: "Environment name used in resource naming.",
      allowedPattern: "^[a-z][a-z0-9]{0,15}$",
    });

    // -- Networking & DNS -------------------------------------------------

    const vpcId = new cdk.CfnParameter(this, "VpcId", {
      type: "AWS::EC2::VPC::Id",
      description:
        "VPC to deploy Documenso into. Must have at least two public subnets in different AZs.",
    });

    const subnetIds = new cdk.CfnParameter(this, "SubnetIds", {
      type: "List<AWS::EC2::Subnet::Id>",
      description: "Public subnet IDs in the selected VPC (at least 2 AZs).",
    });

    const domain = new cdk.CfnParameter(this, "Domain", {
      type: "String",
      description:
        "Fully-qualified hostname (e.g. 'sign.example.com'). Must be a subdomain of an existing Route 53 hosted zone.",
      allowedPattern: "^[a-zA-Z0-9-]+(\\.[a-zA-Z0-9-]+)+$",
    });

    const hostedZoneId = new cdk.CfnParameter(this, "HostedZoneId", {
      type: "AWS::Route53::HostedZone::Id",
      description: "Route 53 hosted zone that will own the DNS record for Domain.",
    });

    // -- Application ------------------------------------------------------

    const containerImage = new cdk.CfnParameter(this, "ContainerImage", {
      type: "String",
      description:
        "Full container image URI (e.g. ghcr.io/<owner>/documenso:latest or <account>.dkr.ecr.<region>.amazonaws.com/documenso:latest).",
    });

    const appName = new cdk.CfnParameter(this, "AppName", {
      type: "String",
      default: "Documenso",
      description:
        "Display name shown as the email 'From' name and used in UI branding.",
    });

    const allowedSignupDomains = new cdk.CfnParameter(this, "AllowedSignupDomains", {
      type: "String",
      default: "",
      description:
        "Comma-separated email domains allowed to sign up (e.g. 'example.com,acme.com'). Leave blank to allow any domain.",
    });

    // -- SSO (Microsoft) --------------------------------------------------

    const microsoftTenantId = new cdk.CfnParameter(this, "MicrosoftTenantId", {
      type: "String",
      default: "common",
      description:
        "Microsoft/Entra tenant ID (or 'common' for multi-tenant). Used only if Microsoft SSO is configured.",
    });

    // -- SMTP -------------------------------------------------------------

    const smtpFromAddress = new cdk.CfnParameter(this, "SmtpFromAddress", {
      type: "String",
      description:
        "Email 'From' address. Must be verified at your SMTP provider (e.g. AWS SES).",
    });

    // -- Sizing -----------------------------------------------------------

    const dbInstanceClass = new cdk.CfnParameter(this, "DbInstanceClass", {
      type: "String",
      default: "t4g.small",
      description: "RDS instance class (e.g. t4g.micro, t4g.small, m7g.large).",
    });
    const dbStorageGb = new cdk.CfnParameter(this, "DbStorageGb", {
      type: "Number",
      default: 20,
      minValue: 20,
      description: "RDS storage in GB. Auto-scales up to 2x this value.",
    });
    const fargateCpu = new cdk.CfnParameter(this, "FargateCpu", {
      type: "Number",
      default: 512,
      allowedValues: ["256", "512", "1024", "2048", "4096"],
      description: "Fargate task CPU in milli-vCPU (1024 = 1 vCPU).",
    });
    const fargateMemory = new cdk.CfnParameter(this, "FargateMemory", {
      type: "Number",
      default: 1024,
      description: "Fargate task memory in MiB. Must be compatible with chosen CPU.",
    });
    const desiredCount = new cdk.CfnParameter(this, "DesiredCount", {
      type: "Number",
      default: 1,
      minValue: 1,
      description: "Number of ECS tasks to run.",
    });

    // -- Build config -----------------------------------------------------

    const config: EnvironmentConfig = {
      mode: "generic",
      envName: envName.valueAsString,
      account: "",
      region: "",
      vpcId: vpcId.valueAsString,
      subnetIds: subnetIds.valueAsList,
      domain: domain.valueAsString,
      hostedZoneId: hostedZoneId.valueAsString,
      containerImage: containerImage.valueAsString,
      containerImageRepo: "",
      dbInstanceClass: dbInstanceClass.valueAsString,
      dbStorageGb: dbStorageGb.valueAsNumber,
      fargateCpu: fargateCpu.valueAsNumber,
      fargateMemory: fargateMemory.valueAsNumber,
      desiredCount: desiredCount.valueAsNumber,
      appName: appName.valueAsString,
      smtpFromAddress: smtpFromAddress.valueAsString,
      allowedSignupDomains: allowedSignupDomains.valueAsString,
      microsoftTenantId: microsoftTenantId.valueAsString,
      appConfigSecretArn: "",
      databaseUrlSecretArn: "",
      uploadsBucketName: "",
    };

    cdk.Tags.of(this).add("project", "documenso");
    cdk.Tags.of(this).add("environment", config.envName);

    const networking = new Networking(this, "Networking", { config });

    const database = new Database(this, "Database", {
      config,
      vpc: networking.vpc,
      subnets: networking.subnets,
      dbSecurityGroup: networking.dbSecurityGroup,
    });

    const secrets = new Secrets(this, "Secrets", { config });

    new Compute(this, "Compute", {
      config,
      vpc: networking.vpc,
      subnets: networking.subnets,
      appSecurityGroup: networking.appSecurityGroup,
      dbEndpoint: database.dbEndpoint,
      dbPort: database.dbPort,
      dbSecret: database.dbSecret,
      appConfigSecret: secrets.appConfig,
      databaseUrlSecret: secrets.databaseUrl,
      targetGroup: networking.appTargetGroup,
    });

    // -- Parameter groupings for CloudFormation Console UX ----------------

    this.templateOptions.metadata = {
      "AWS::CloudFormation::Interface": {
        ParameterGroups: [
          {
            Label: { default: "Environment" },
            Parameters: ["EnvName"],
          },
          {
            Label: { default: "Networking & DNS" },
            Parameters: ["VpcId", "SubnetIds", "Domain", "HostedZoneId"],
          },
          {
            Label: { default: "Application" },
            Parameters: [
              "ContainerImage",
              "AppName",
              "AllowedSignupDomains",
              "SmtpFromAddress",
            ],
          },
          {
            Label: { default: "SSO (Microsoft)" },
            Parameters: ["MicrosoftTenantId"],
          },
          {
            Label: { default: "Sizing" },
            Parameters: [
              "DbInstanceClass",
              "DbStorageGb",
              "FargateCpu",
              "FargateMemory",
              "DesiredCount",
            ],
          },
        ],
      },
    };
  }
}
