#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DocumensoStack } from "../lib/documenso-stack";
import { getConfig } from "../lib/config";

const app = new cdk.App();

const env = app.node.tryGetContext("env") || "dev";
const config = getConfig(env);

new DocumensoStack(app, `Documenso-${config.envName}`, {
  config,
  env: {
    account: config.account,
    region: config.region,
  },
});
