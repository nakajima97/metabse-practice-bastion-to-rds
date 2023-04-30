import { CfnKeyPair } from '@aws-cdk/aws-ec2';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps, Token, aws_ec2, aws_rds } from 'aws-cdk-lib';
import { Ec2Action } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Instance, InstanceClass, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class MetabsePracticeBastionToRdsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // VPC作成
    const vpc = new Vpc(this, 'MainVPC', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public-subnet',
          subnetType: SubnetType.PUBLIC
        },
        {
          cidrMask: 24,
          name: 'private-subnet',
          subnetType: SubnetType.PRIVATE_ISOLATED
        }
      ]
    });

    // ec2用のSecurityGroup作成
    const ec2SecurityGroup = new aws_ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: "Allow SSH",
      allowAllOutbound: true
    });
    ec2SecurityGroup.addIngressRule(
      aws_ec2.Peer.anyIpv4(),
      aws_ec2.Port.tcp(22),
      'Allow SSH Access'
    );

    // key pair作成
    const cfnKeyPair = new aws_ec2.CfnKeyPair(this, 'CfnKeyPair', {
      keyName: 'bastion-private-key'
    });
    cfnKeyPair.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // key pair取得コマンドの出力
    new CfnOutput(this, 'GetSSHKeyCommand', {
      value: `aws ssm get-parameter --name /ec2/keypair/${cfnKeyPair.getAtt('KeyPairId')} --region ${this.region} --with-decryption --query Parameter.Value --output text`,
    });

    // ec2作成
    new aws_ec2.Instance(this, 'BastionHost', {
      vpc,
      vpcSubnets: { subnetType: aws_ec2.SubnetType.PUBLIC },
      instanceType: aws_ec2.InstanceType.of(
        aws_ec2.InstanceClass.T2,
        aws_ec2.InstanceSize.MICRO
      ),
      machineImage: new aws_ec2.AmazonLinuxImage({
        generation: aws_ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
      }),
      securityGroup: ec2SecurityGroup,
      keyName: Token.asString(cfnKeyPair.ref)
    });

    // RDS
    const rdsSecurityGroup = new aws_ec2.SecurityGroup(this, 'rds-security-group', {
      allowAllOutbound: true,
      description: "Allow 3306 in",
      vpc
    });
    rdsSecurityGroup.addIngressRule(
      ec2SecurityGroup,
      aws_ec2.Port.tcp(3306),
      'Allow 3306 access',
    );

    const rdsCredential = aws_rds.Credentials.fromGeneratedSecret('clusteradmin');
    const rdsCluster = new aws_rds.DatabaseCluster(this, 'RDS', {
      engine: aws_rds.DatabaseClusterEngine.auroraMysql({
        version: aws_rds.AuroraMysqlEngineVersion.VER_3_02_1
      }),
      credentials: rdsCredential,
      instanceProps: {
        instanceType: aws_ec2.InstanceType.of(aws_ec2.InstanceClass.BURSTABLE3, aws_ec2.InstanceSize.MEDIUM),
        vpcSubnets: {
          subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED
        },
        vpc,
        securityGroups: [rdsSecurityGroup]
      },
    })
  }
}
