/**
 * Simple Slack client that uses Web API polling instead of Socket Mode
 * This is a fallback for environments where Socket Mode doesn't work properly
 */

import { WebClient } from '@slack/web-api';
import { Human } from './human.js';
import { MessageLogEntry } from './types.js';

const logger = {
  info: (message: string) => console.error(`[INFO] ${new Date().toISOString()} - ${message}`),
  error: (message: string) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`),
  warn: (message: string) => console.error(`[WARN] ${new Date().toISOString()} - ${message}`),
};

export class SimpleSlackHandler {
  public webClient: WebClient;
  public isReady: boolean = false;

  constructor(botToken: string) {
    this.webClient = new WebClient(botToken);
  }

  async start(): Promise<void> {
    logger.info('Starting Simple Slack client (Web API mode)...');

    // Test authentication
    try {
      const authResponse = await this.webClient.auth.test();
      if (authResponse.ok) {
        logger.info(`Slack bot ready as ${authResponse.user}`);
        logger.info(`Team: ${authResponse.team}`);
        this.isReady = true;
      } else {
        throw new Error(`Auth test failed: ${authResponse.error}`);
      }
    } catch (error) {
      logger.error(`Failed to authenticate with Slack: ${error}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Simple Slack client stopped');
  }
}

export class SimpleHumanInSlack extends Human {
  public handler?: SimpleSlackHandler;
  private messageLog: MessageLogEntry[] = [];
  private eventCount: number = 0;

  constructor(
    private userId: string,
    private channelId: string
  ) {
    super();
  }

  setHandler(handler: SimpleSlackHandler): void {
    this.handler = handler;
    logger.info('Simple Slack handler set');
  }

  async ask(question: string): Promise<string> {
    if (!this.handler || !this.handler.isReady) {
      throw new Error('Slack connection is not ready');
    }

    // Note: Simple mode uses polling, no need for questionId tracking

    try {
      // Send the question with user mention
      const messageText = `<@${this.userId}> ${question}`;

      // Post message to channel
      const result = await this.handler.webClient.chat.postMessage({
        channel: this.channelId,
        text: messageText,
      });

      if (!result.ok) {
        throw new Error(`Failed to send message: ${result.error}`);
      }

      const threadTs = result.ts!;
      logger.info(`Sent question to Slack channel ${this.channelId}, thread ${threadTs}`);

      // Poll for responses
      const timeout = 60000; // 60 seconds
      const pollInterval = 2000; // 2 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        // Check for replies in the thread
        try {
          const replies = await this.handler.webClient.conversations.replies({
            channel: this.channelId,
            ts: threadTs,
            limit: 10,
          });

          if (replies.messages && replies.messages.length > 1) {
            // Find messages from the target user (skip the original message)
            for (const msg of replies.messages.slice(1)) {
              if (msg.user === this.userId && msg.text) {
                logger.info(`Received response: ${msg.text.slice(0, 50)}...`);
                return msg.text;
              }
            }
          }
        } catch (error) {
          logger.warn(`Error polling for replies: ${error}`);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      throw new Error('Timeout waiting for human response in Slack');

    } catch (error) {
      throw error;
    }
  }

  getMessageLog(): MessageLogEntry[] {
    return [...this.messageLog];
  }

  getEventCount(): number {
    return this.eventCount;
  }
}