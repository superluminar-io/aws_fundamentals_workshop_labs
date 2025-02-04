import {CfnOutput, RemovalPolicy, Stack, StackProps} from 'aws-cdk-lib'
import {
    SubnetType,
    Vpc,
    SecurityGroup,
    Port,
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
    LogDrivers
} from "aws-cdk-lib/aws-ecs";
import {ApplicationLoadBalancer, ApplicationProtocol} from "aws-cdk-lib/aws-elasticloadbalancingv2";

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
            environment: {
                DB_HOST: 'some-host',
                DB_USERNAME: 'some-user',
                DB_PASSWORD: 'some-password',
            }
        });

        // Create a Fargate Service
        const service = new FargateService(this, 'FargateService', {
            cluster,
            taskDefinition: fargateTaskDefinition,
            minHealthyPercent: 100,
            vpcSubnets: {subnetType: SubnetType.PRIVATE_WITH_EGRESS},
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

        // Security Group for RDS instance that allows ingress from the ECS service
        const rdsSecurityGroup = new SecurityGroup(this, 'RDSSecurityGroup', {
            vpc,
            allowAllOutbound: true,
            description: 'Allow MySQL access to RDS instance',
        })
        rdsSecurityGroup.addIngressRule(
            service.connections.securityGroups[0],
            Port.tcp(3306),
            'Allow MySQL access from ECS service'
        )

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

        // Output the RDS Security Group ID for easy reference
        new CfnOutput(this, 'RDSSecurityGroupId', {
            value: rdsSecurityGroup.securityGroupId,
        })

        // Output the VPC ID
        new CfnOutput(this, 'VpcId', {
            value: vpc.vpcId,
        })
    }
}
