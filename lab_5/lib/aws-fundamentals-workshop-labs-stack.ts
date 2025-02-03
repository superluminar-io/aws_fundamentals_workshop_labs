import {aws_secretsmanager, CfnOutput, Duration, RemovalPolicy, Stack, StackProps} from 'aws-cdk-lib'
import {
  SubnetType,
  Vpc,
  SecurityGroup, InstanceType, InstanceClass, InstanceSize,
} from 'aws-cdk-lib/aws-ec2'
import {
  ArnPrincipal,
  PolicyStatement,
} from 'aws-cdk-lib/aws-iam'
import {BlockPublicAccess, Bucket} from 'aws-cdk-lib/aws-s3'
import {Construct} from 'constructs'
import {
  Cluster,
  ContainerImage,
  FargateService,
  FargateTaskDefinition,
  ListenerConfig,
  LogDrivers, Secret
} from "aws-cdk-lib/aws-ecs";
import {ApplicationLoadBalancer, ApplicationProtocol} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine,
  MysqlEngineVersion
} from "aws-cdk-lib/aws-rds";

export class AwsFundamentalsWorkshopLabsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // Create a VPC
    const vpc = new Vpc(this, 'MyVpc', {
      natGateways: 1, // Default is one in each AZ, this creates only one instead of two.
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS, // This creates a private subnet with egress access to the internet.
        },
      ],
    })


    // Security Group for RDS instance
    const rdsSecurityGroup = new SecurityGroup(this, 'RDSSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'Allow MySQL access to RDS instance',
    })

    // Create a secret for the RDS instance
    const databaseCredentials = Credentials.fromGeneratedSecret('admin',
      {
        secretName: 'MyRDSSecret'
      }
    );
    const databaseSecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'MyRDSSecret', databaseCredentials.secretName!);

    // Create an RDS instance
    const rdsInstance = new DatabaseInstance(this, 'MyRDSInstance', {
      // Choose the MySQL engine version
      engine: DatabaseInstanceEngine.mysql({
        version: MysqlEngineVersion.VER_8_0_37,
      }),
      // select the VPC
      vpc,
      // select the instance type
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      // select the subnet type to deploy the RDS instance in
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      // select the security group we created
      securityGroups: [rdsSecurityGroup],
      // set the credentials to be generated in AWS Secrets Manager
      credentials: databaseCredentials, // Generates a secret in Secrets Manager
      // set the multi-az to false for a single-az deployment
      multiAz: false,
      // select the allocated storage
      allocatedStorage: 20,
      // select the max allocated storage
      maxAllocatedStorage: 100,
      // disallow major version upgrades
      allowMajorVersionUpgrade: false,
      // enable auto-minor version upgrades
      autoMinorVersionUpgrade: true,
      // set the backup retention to 7 days
      backupRetention: Duration.days(7),
      // disable deletion protection
      deletionProtection: false,
      // set the database name
      databaseName: 'MyDatabase',
    })


    // Create the ECS Cluster
    const cluster = new Cluster(this, 'FargateCluster', {
      vpc,
    });

    // Create a Fargate Task Definition with a Container
    const fargateTaskDefinition = new FargateTaskDefinition(this, 'TaskDef');
    fargateTaskDefinition.addContainer('AppContainer', {
      containerName: 'web',
      image: ContainerImage.fromRegistry('ghcr.io/superluminar-io/dct:latest'),
      memoryLimitMiB: 512,
      cpu: 256,
      logging: LogDrivers.awsLogs({streamPrefix: 'myApp/webapp'}),
      portMappings: [{containerPort: 8081}],
      secrets: {
        DB_HOST: Secret.fromSecretsManager(databaseSecret, 'host'),
        DB_USERNAME: Secret.fromSecretsManager(databaseSecret, 'username'),
        DB_PASSWORD: Secret.fromSecretsManager(databaseSecret, 'password'),
      }
    });


    // Create a Fargate Service
    const service = new FargateService(this, 'FargateService', {
      cluster,
      taskDefinition: fargateTaskDefinition,
      minHealthyPercent: 100,
      vpcSubnets: {subnetType: SubnetType.PRIVATE_WITH_EGRESS},
      enableExecuteCommand: true,
    });

    // Create an Application Load Balancer that listens on port 80
    const lb = new ApplicationLoadBalancer(this, 'LoadBalancer', {vpc, internetFacing: true});
    const listener = lb.addListener('LBListener', {port: 80});

    // Register the ECS Service as a target of the Application Load Balancer
    service.registerLoadBalancerTargets(
      {
        containerName: 'web',
        containerPort: 8081,
        newTargetGroupId: 'ecs_webapp',
        listener: ListenerConfig.applicationListener(listener, {
          protocol: ApplicationProtocol.HTTP,
        }),
      },
    );

    rdsInstance.connections.allowDefaultPortFrom(service, 'Allow access from ECS service')

    // Create an S3 bucket
    const bucket = new Bucket(this, 'MyBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false, // Ensure the bucket is not publicly accessible
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL, // Block all public access
    })

    // Add a bucket policy that allows access from the ECS service
    bucket.addToResourcePolicy(
      new PolicyStatement({
        actions: [
          's3:GetObject',
          's3:ListBucket',
          's3:PutObject',
          's3:DeleteObject',
          's3:DeleteBucket',
        ],
        resources: [bucket.bucketArn, bucket.arnForObjects('*')],
        principals: [new ArnPrincipal(service.taskDefinition.taskRole.roleArn)],
      })
    )

    // Output the RDS instance endpoint
    new CfnOutput(this, 'RDSInstanceEndpoint', {
      value: rdsInstance.dbInstanceEndpointAddress,
    })

    // Output the RDS instance identifier
    new CfnOutput(this, 'RDSInstanceIdentifier', {
      value: rdsInstance.instanceIdentifier,
    })

    // Output the RDS instance secret ARN
    new CfnOutput(this, 'RDSInstanceSecretArn', {
      value: rdsInstance.secret?.secretArn || '',
    })

    //Output the Load Balancer DNS Name for easy reference
    new CfnOutput(this, 'LoadBalancerDNS', {
      value: lb.loadBalancerDnsName,
      description: 'DNS Name of the Application Load Balancer',
    })

    // Output the bucket name for easy reference
    new CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'Name of the S3 bucket',
    })

    new CfnOutput(this, 'RDSSecurityGroupId', {
      value: rdsSecurityGroup.securityGroupId,
    })

    // Output the VPC ID
    new CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
    })
  }
}
