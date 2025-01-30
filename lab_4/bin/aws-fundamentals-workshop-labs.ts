#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { AwsFundamentalsWorkshopLabsStack } from '../lib/aws-fundamentals-workshop-labs-stack'

const app = new cdk.App()
new AwsFundamentalsWorkshopLabsStack(app, 'AwsFundamentalsWorkshopLabsStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
})
