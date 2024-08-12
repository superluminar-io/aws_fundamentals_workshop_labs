import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib'
import { Construct } from 'constructs'

export class AwsFundamentalsWorkshopLabsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
    // Resources go here
    new CfnOutput(this, 'MyOutput', {
      value: 'Hello, CDK!',
      description: 'A simple CloudFormation output to prove the setup works',
    })
  }
}
