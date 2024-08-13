# AWS Fundamentals Workshop Labs

This repository contains the completed code for the labs in the AWS Fundamentals Workshop created by superluminar. The workshop is designed to provide hands-on experience with core AWS services using AWS CDK (Cloud Development Kit) with TypeScript.

## Repository Structure

The repository is organized into multiple lab directories, each representing a different stage or concept in the workshop:

- `lab_1`: Introduction to AWS CDK
- `lab_2`: Working with Lambda and S3
- `lab_3`: Networking with VPC and Security Groups
- `lab_4`: EC2 and S3 Integration
- `lab_5`: RDS Database Integration

Each lab directory contains its own CDK stack implementation and associated resources.

## Prerequisites

To run these labs, you'll need:

1. An AWS account
2. Node.js and npm installed
3. AWS CDK CLI installed (`npm install -g aws-cdk`)
4. AWS CLI configured with your credentials

## Getting Started

1. Clone this repository
2. Navigate to the desired lab directory (e.g., `cd lab_1`)
3. Install dependencies: `npm install`
4. Deploy the stack: `cdk deploy`

## Lab Highlights

### Lab 1: Introduction to AWS CDK

Basic CDK setup and a simple CloudFormation output.

### Lab 2: Lambda and S3

Creates an S3 bucket and a Lambda function with permissions to interact with the bucket.

### Lab 3: Networking

Sets up a VPC with public and private subnets, and configures security groups.

### Lab 4: EC2 and S3

Deploys an EC2 instance with access to an S3 bucket, demonstrating IAM roles and security groups.

### Lab 5: RDS Integration

Adds an RDS MySQL instance to the existing infrastructure, showcasing database deployment and security configurations.

## Important Notes

- Each lab builds upon the previous ones, gradually increasing in complexity. Labs 1 and 2 are intended to be reset before continuing with the other labs. Labs 3, 4, and 5 do not need to be reset.
- Make sure to destroy the stacks after you're done to avoid unnecessary AWS charges: `cdk destroy`
- Review the AWS pricing for the services used in these labs.

## Resources

For more information on the services and concepts covered in this workshop, refer to the official AWS documentation:

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/latest/guide/home.html)
- [Amazon EC2](https://aws.amazon.com/ec2/)
- [Amazon S3](https://aws.amazon.com/s3/)
- [Amazon RDS](https://aws.amazon.com/rds/)
- [AWS Lambda](https://aws.amazon.com/lambda/)
- [Amazon VPC](https://aws.amazon.com/vpc/)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
