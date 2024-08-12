import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib'
import {
  SubnetType,
  Vpc,
  SecurityGroup,
  Peer,
  Port,
  Instance,
  InstanceType,
  InstanceClass,
  InstanceSize,
  MachineImage,
  UserData,
} from 'aws-cdk-lib/aws-ec2'
import {
  ArnPrincipal,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam'
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine,
  MysqlEngineVersion,
} from 'aws-cdk-lib/aws-rds'
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'

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

    // Security Group for EC2 instance
    const ec2SecurityGroup = new SecurityGroup(this, 'EC2SecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'Allow HTTP access to EC2 instance',
    })

    // Allow HTTP access to the EC2 instance
    ec2SecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(80),
      'Allow HTTP access'
    )

    // Security Group for RDS instance
    const rdsSecurityGroup = new SecurityGroup(this, 'RDSSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'Allow MySQL access to RDS instance',
    })
    rdsSecurityGroup.addIngressRule(
      ec2SecurityGroup,
      Port.tcp(3306),
      'Allow MySQL access from EC2 instance'
    )

    // IAM role for EC2 instance to use SSM
    const role = new Role(this, 'SSMRole', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
    })

    // Attach the AmazonSSMManagedInstanceCore managed policy to the role
    role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    )

    // Add S3 read permissions to the EC2 instance role
    role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')
    )

    // Create an EC2 instance
    const ec2Instance = new Instance(this, 'MyEC2Instance', {
      vpc,
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
      machineImage: MachineImage.latestAmazonLinux2(),
      securityGroup: ec2SecurityGroup,
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
      role: role,
      userData: UserData.forLinux(),
    })

    // Install AWS CLI on the EC2 instance
    ec2Instance.addUserData(
      'yum update -y',
      'yum install -y aws-cli',
      'echo "AWS CLI installed. You can now use AWS S3 commands to test bucket access."'
    )

    // Create an S3 bucket
    const bucket = new Bucket(this, 'MyBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false, // Ensure the bucket is not publicly accessible
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL, // Block all public access
    })

    // Add a bucket policy that allows access from the EC2 instance
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
        principals: [new ArnPrincipal(ec2Instance.role.roleArn)],
      })
    )

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
      credentials: Credentials.fromGeneratedSecret('admin'), // Generates a secret in Secrets Manager
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

    // Output the bucket name for easy reference
    new CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'Name of the S3 bucket',
    })

    // Output the EC2 instance ID
    new CfnOutput(this, 'EC2InstanceId', {
      value: ec2Instance.instanceId,
    })

    // Output the Security Group IDs
    new CfnOutput(this, 'EC2SecurityGroupId', {
      value: ec2SecurityGroup.securityGroupId,
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
