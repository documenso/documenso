#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DocumensoStack } from "../lib/documenso-stack";
import { getInternalConfig } from "../lib/config";

const app = new cdk.App();

const envName = app.node.tryGetContext("env") || "dev";
const config = getInternalConfig(envName);

new DocumensoStack(app, `Documenso-${config.envName}`, {
  config,
  env: {
    account: config.account,
    region: config.region,
  },
});
