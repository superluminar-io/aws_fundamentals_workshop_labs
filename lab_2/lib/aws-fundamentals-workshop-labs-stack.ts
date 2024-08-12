import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import {
  Policy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam'
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'

export class AwsFundamentalsWorkshopLabsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // Create an S3 bucket with a destroy policy
    const bucket = new Bucket(this, 'MyBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    // Define an IAM Role for Lambda
    const lambdaRole = new Role(this, 'LambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    })

    // Correct IAM Policy
    const correctPolicy = new Policy(this, 'CorrectPolicy', {
      statements: [
        new PolicyStatement({
          actions: ['s3:GetObject', 's3:PutObject'],
          resources: [bucket.bucketArn + '/*'],
        }),
      ],
    })

    // Attach the correct policy to the Lambda role
    lambdaRole.attachInlinePolicy(correctPolicy)

    // Create a Lambda function with inline code
    const lambdaFunction = new Function(this, 'MyLambda', {
      runtime: Runtime.NODEJS_LATEST,
      handler: 'index.handler',
      code: Code.fromInline(`
        const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
        const s3Client = new S3Client();
    
        exports.handler = async function(event) {
          const params = {
            Bucket: process.env.BUCKET_NAME,
            Key: 'hello.txt',
            Body: 'Hello World',
            ContentType: 'text/plain'
          };
          try {
            await s3Client.send(new PutObjectCommand(params));
            return {
              statusCode: 200,
              body: 'File written!'
            };
          } catch (error) {
            console.error('Error:', error);
            return {
              statusCode: 500,
              body: 'Error writing file'
            };
          }
        }
      `),
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
      role: lambdaRole,
    })

    // Output the Lambda function name
    new CfnOutput(this, 'LambdaFunctionName', {
      value: lambdaFunction.functionName,
    })

    // Output the bucket name
    new CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
    })

    // Output the Lambda function ARN
    new CfnOutput(this, 'LambdaArn', {
      value: lambdaFunction.functionArn,
    })
  }
}
