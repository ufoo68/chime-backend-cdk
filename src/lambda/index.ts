import { APIGatewayEvent } from 'aws-lambda'
import * as aws from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'

const dynamo = new aws.DynamoDB()
const chime = new aws.Chime()

const tableName = process.env.TABLE_NAME ?? ''

type JoinEvent = {
  title: string;
  name: String;
}

type LeaveEvent = {
  title: string;
}

export const join = async ({ body }: APIGatewayEvent) => {
  const { title, name }: JoinEvent = JSON.parse(body ?? '{}')
  if (!title || !name) {
    return response(400, 'application/json', JSON.stringify({ error: 'Need parameters: title, name, region' }))
  }
  let meeting = await getMeeting(title)
  if (!meeting) {
    meeting = await chime.createMeeting({
      ClientRequestToken: uuidv4(),
      ExternalMeetingId: title.substring(0, 64),
    }).promise()
    await putMeeting(title, meeting)
  }
  const attendee = (await chime.createAttendee({
    MeetingId: meeting.Meeting.MeetingId,
    ExternalUserId: `${uuidv4().substring(0, 8)}#${name}`.substring(0, 64),
  }).promise())

  return response(200, 'application/json', JSON.stringify({
    JoinInfo: {
      Meeting: meeting,
      Attendee: attendee,
    },
  }, null, 2))
}

export const leave = async ({ body }: APIGatewayEvent) => {
  const { title }: LeaveEvent = JSON.parse(body ?? '{}')
  const meeting = await getMeeting(title)

  // End the meeting. All attendee connections will hang up.
  await chime.deleteMeeting({ MeetingId: meeting.Meeting.MeetingId }).promise()
  return response(200, 'application/json', JSON.stringify({}))
}

const getMeeting = async (title: string) => {
  const result = await dynamo.getItem({
    TableName: tableName,
    Key: {
      Title: {
        S: title,
      },
    },
  }).promise()
  return result.Item ? JSON.parse(result.Item?.S?.S ?? '{}') : null
}

// Stores the meeting in the table using the meeting title as the key
const putMeeting = async (title: string, meeting: any) => {
  await dynamo.putItem({
    TableName: tableName,
    Item: {
      Title: { S: title },
      Data: { S: JSON.stringify(meeting) },
      TTL: {
        N: `${Math.floor(Date.now() / 1000) + 60 * 60 * 24}`,
      },
    },
  }).promise()
}

const response = (statusCode: number, contentType: string, body: any) => {
  return {
    statusCode: statusCode,
    headers: { 'Content-Type': contentType },
    body: body,
    isBase64Encoded: false,
  }
}
