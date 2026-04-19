#!/usr/bin/env node
/**
 * Entry point that synthesizes the customer-facing CloudFormation template.
 * Emits a self-contained template to `cdk.out.generic/` that downstream
 * tooling converts to YAML and commits to `cfn/documenso.yml`.
 *
 * Uses LegacyStackSynthesizer so the template does NOT depend on CDK
 * bootstrap resources in the customer's AWS account — deploys work out of
 * the box via `aws cloudformation deploy` without running `cdk bootstrap`.
 */
import * as cdk from "aws-cdk-lib";
import { GenericDocumensoStack } from "../lib/documenso-stack-generic";

const app = new cdk.App();

new GenericDocumensoStack(app, "Documenso", {
  description:
    "Documenso document-signing platform — ECS Fargate + RDS Postgres + S3.",
  synthesizer: new cdk.LegacyStackSynthesizer(),
});
