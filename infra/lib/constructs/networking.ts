import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import type { EnvironmentConfig } from "../config";

export interface NetworkingProps {
  readonly config: EnvironmentConfig;
}

/**
 * Imports an existing VPC + public subnets (via lookup in internal mode, via
 * CFN tokens in generic mode), then creates security groups, an ALB with TLS
 * termination, and a Route 53 alias record for the configured domain.
 */
export class Networking extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly subnets: ec2.ISubnet[];
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly appSecurityGroup: ec2.SecurityGroup;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly appTargetGroup: elbv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: NetworkingProps) {
    super(scope, id);

    const { config } = props;

    // -- Import existing VPC and subnets ----------------------------------
    //
    // Internal mode resolves the VPC at synth time via lookup. Generic mode
    // receives vpcId/subnetIds as CFN tokens, which can't be resolved at
    // synth, so we use fromVpcAttributes + Fn.getAzs().
    if (config.mode === "internal") {
      this.vpc = ec2.Vpc.fromLookup(this, "Vpc", { vpcId: config.vpcId });
    } else {
      this.vpc = ec2.Vpc.fromVpcAttributes(this, "Vpc", {
        vpcId: config.vpcId,
        availabilityZones: cdk.Fn.getAzs(),
        publicSubnetIds: config.subnetIds,
      });
    }

    this.subnets = config.subnetIds.map((subnetId, i) =>
      ec2.Subnet.fromSubnetId(this, `Subnet${i + 1}`, subnetId),
    );

    // -- Security Groups --------------------------------------------------

    this.albSecurityGroup = new ec2.SecurityGroup(this, "AlbSg", {
      vpc: this.vpc,
      securityGroupName: `documenso-alb-${config.envName}`,
      description: "Documenso ALB - HTTP/HTTPS from internet",
    });
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "HTTP from anywhere",
    );
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "HTTPS from anywhere",
    );

    this.appSecurityGroup = new ec2.SecurityGroup(this, "AppSg", {
      vpc: this.vpc,
      securityGroupName: `documenso-app-${config.envName}`,
      description: "Documenso ECS service - traffic from ALB only",
    });
    this.appSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(3000),
      "Documenso app from ALB",
    );

    this.dbSecurityGroup = new ec2.SecurityGroup(this, "DbSg", {
      vpc: this.vpc,
      securityGroupName: `documenso-db-${config.envName}`,
      description: "Documenso RDS - access from ECS service",
    });
    this.dbSecurityGroup.addIngressRule(
      this.appSecurityGroup,
      ec2.Port.tcp(5432),
      "PostgreSQL from ECS service",
    );

    // -- ALB --------------------------------------------------------------

    this.alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc: this.vpc,
      internetFacing: true,
      securityGroup: this.albSecurityGroup,
      loadBalancerName: `documenso-${config.envName}`,
      vpcSubnets: { subnets: this.subnets },
    });

    // -- Target Group -----------------------------------------------------

    this.appTargetGroup = new elbv2.ApplicationTargetGroup(this, "AppTg", {
      vpc: this.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      targetGroupName: `documenso-app-${config.envName}`,
      healthCheck: {
        path: "/api/health",
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // -- TLS Certificate --------------------------------------------------

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "Zone",
      {
        hostedZoneId: config.hostedZoneId,
        zoneName: config.domain.split(".").slice(1).join("."),
      },
    );

    const certificate = new acm.Certificate(this, "Cert", {
      domainName: config.domain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // -- Listeners --------------------------------------------------------

    // HTTP -> HTTPS redirect
    this.alb.addListener("HttpListener", {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: "HTTPS",
        port: "443",
        permanent: true,
      }),
    });

    // HTTPS -> target group
    this.alb.addListener("HttpsListener", {
      port: 443,
      certificates: [certificate],
      defaultTargetGroups: [this.appTargetGroup],
    });

    // -- Route 53 A record ------------------------------------------------

    new route53.ARecord(this, "AliasRecord", {
      zone: hostedZone,
      recordName: config.domain,
      target: route53.RecordTarget.fromAlias(
        new targets.LoadBalancerTarget(this.alb),
      ),
    });

    // -- Outputs ----------------------------------------------------------

    new cdk.CfnOutput(this, "AlbDns", {
      value: this.alb.loadBalancerDnsName,
      description: "ALB DNS name",
    });
  }
}
