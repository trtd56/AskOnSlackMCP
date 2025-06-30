/**
 * Type definitions for the Human-in-the-Loop Slack MCP Server
 */

export interface Config {
  slackBotToken: string;
  slackAppToken: string;
  slackChannelId: string;
  slackUserId: string;
  logLevel?: string;
}

export interface PendingResponse {
  channel: string;
  user: string;
  threadTs: string;
  response: string | null;
  received: boolean;
}

export interface MessageLogEntry {
  timestamp: number;
  channel?: string;
  user?: string;
  text: string;
  threadTs?: string;
  botId?: string;
}

export interface SlackMessageEvent {
  type: string;
  channel?: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
}