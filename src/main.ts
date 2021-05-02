import { App, Stack, StackProps, aws_lambda_nodejs, aws_lambda, aws_apigateway, aws_dynamodb } from 'aws-cdk-lib'
import { Construct } from 'constructs'

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props)

    const table = new aws_dynamodb.Table(this, 'table', {
      partitionKey: {
        name: 'title',
        type: aws_dynamodb.AttributeType.STRING,
      },
      timeToLiveAttribute: 'ttl',
    })
    const joinMeeting = new aws_lambda_nodejs.NodejsFunction(this, 'join', {
      runtime: aws_lambda.Runtime.NODEJS_14_X,
      entry: 'src/lambda/index.ts',
      handler: 'join',
      environment: {
        TABLE_NAME: table.tableName,
      },
    })
    const leaveMeeting = new aws_lambda_nodejs.NodejsFunction(this, 'leave', {
      runtime: aws_lambda.Runtime.NODEJS_14_X,
      entry: 'src/lambda/index.ts',
      handler: 'leave',
      environment: {
        TABLE_NAME: table.tableName,
      },
    })
    table.grantReadWriteData(joinMeeting)
    table.grantReadData(leaveMeeting)
    const api = new aws_apigateway.RestApi(this, 'api')
    api.root.addResource('join').addMethod('POST', new aws_apigateway.LambdaIntegration(joinMeeting))
    api.root.addResource('leave').addMethod('POST', new aws_apigateway.LambdaIntegration(leaveMeeting))
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
}

const app = new App()

new MyStack(app, 'chime-backend-dev', { env: devEnv })
// new MyStack(app, 'my-stack-prod', { env: prodEnv });

app.synth()